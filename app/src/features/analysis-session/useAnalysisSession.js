import { useCallback, useEffect, useRef, useState } from 'react'
import { createJob, DEFAULT_SKELETON_PAGE_LIMIT, downloadSkeletonFile, getBenchmark, getJobResult, getJobStatus, getSkeletonPage } from '../../api/analysisClient.js'
import { adaptJobStatus, adaptResult, adaptSkeletonPage } from './adapters.js'

const ACTIVE_STATUSES = new Set(['uploading', 'queued', 'extracting', 'analyzing', 'generating_feedback'])

const DEFAULT_FORM = {
    videoFile: null,
    samplingFps: null,
    exerciseType: 'squat',
    bodyweightKg: 73,
    externalLoadKg: 260,
    barPlacementMode: 'high_bar',
    modelAssetPath: '',
    modelVariant: 'full',
    delegate: 'CPU',
}

const DEFAULT_VIZ_CONFIG = {
    showSkeleton: true,
    showJointLabels: false,
    showAngleOverlay: false,
    showJointLoad: false,
    showIssueMarkers: true,
    showRepBoundaries: true,
    showEventMarkers: true,
    showPathTrace: false,
    showConfidenceTint: false,
    showBarPass: false,
    showGroundVector: false,
    showCoP: false,
}

const INITIAL_STATE = {
    status: 'idle',
    form: DEFAULT_FORM,
    vizConfig: DEFAULT_VIZ_CONFIG,
    jobMeta: {
        jobId: null,
        progress: null,
        error: null,
    },
    result: null,
    skeletonPage: null,
    benchmarkDetails: null,
    validationError: '',
    userMessage: '',
    stageMoments: {},
    startedAt: null,
    now: Date.now(),
}

function sanitizeNumber(value) {
    if (value === '' || value == null) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function buildUserError(error) {
    if (error?.status === 404) return 'Analysis session not found. Start a new run.'
    if (error?.status === 409) return 'Results are not ready yet. Polling will continue until the backend completes.'
    if (error?.message?.includes('Unsupported exercise_type')) return 'Only squat is supported in this MVP demo.'
    return error?.message || 'Analysis request failed. Check the backend and try again.'
}

function getPollingDelay({ pollCount, startedAt }) {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    const elapsedMs = startedAt ? Date.now() - startedAt : 0

    if (hidden) return 3000
    if (elapsedMs > 45000) return 2500
    if (elapsedMs > 20000) return 1500
    if (pollCount < 3) return 500
    return 1000
}

function mergeSkeletonPages(pages) {
    if (!pages.length) return null

    const [firstPage] = pages
    const mergedFrames = pages.flatMap(page => Array.isArray(page?.frames) ? page.frames : [])
    const totalFrames = pages.reduce((max, page) => (
        Number.isFinite(page?.totalFrames) ? Math.max(max, page.totalFrames) : max
    ), mergedFrames.length)

    return {
        ...firstPage,
        frames: mergedFrames,
        offset: 0,
        limit: mergedFrames.length,
        totalFrames,
        pageCount: pages.length,
    }
}

async function getAllSkeletonPages(jobId, { signal, limit = DEFAULT_SKELETON_PAGE_LIMIT } = {}) {
    const pages = []
    let offset = 0
    let totalFrames = null

    while (true) {
        const page = await getSkeletonPage(jobId, offset, limit, { signal })
        pages.push(page)

        const frames = Array.isArray(page?.frames) ? page.frames : []
        const pageOffset = Number.isFinite(page?.offset) ? page.offset : offset
        const nextOffset = pageOffset + frames.length

        if (Number.isFinite(page?.totalFrames)) {
            totalFrames = page.totalFrames
        }

        if (!frames.length) break
        if (totalFrames != null && nextOffset >= totalFrames) break
        if (nextOffset <= offset) break

        offset = nextOffset
    }

    return mergeSkeletonPages(pages)
}

export function useAnalysisSession() {
    const [state, setState] = useState(INITIAL_STATE)
    const runRef = useRef({
        runId: 0,
        timeoutId: null,
        pollCount: 0,
        abortController: null,
    })

    const clearRun = useCallback(() => {
        if (runRef.current.timeoutId) {
            window.clearTimeout(runRef.current.timeoutId)
        }
        runRef.current.timeoutId = null
        runRef.current.pollCount = 0
        runRef.current.abortController?.abort()
        runRef.current.abortController = null
    }, [])

    useEffect(() => () => clearRun(), [clearRun])

    useEffect(() => {
        if (!ACTIVE_STATUSES.has(state.status)) return undefined

        const intervalId = window.setInterval(() => {
            setState(prev => ({ ...prev, now: Date.now() }))
        }, 250)

        return () => window.clearInterval(intervalId)
    }, [state.status])

    const markStage = useCallback((stage) => {
        setState(prev => {
            if (!stage || prev.stageMoments[stage]) {
                return { ...prev, now: Date.now() }
            }

            return {
                ...prev,
                stageMoments: {
                    ...prev.stageMoments,
                    [stage]: Date.now(),
                },
                now: Date.now(),
            }
        })
    }, [])

    const updateForm = useCallback((key, value) => {
        setState(prev => ({
            ...prev,
            form: {
                ...prev.form,
                [key]: value,
            },
            validationError: '',
            userMessage: '',
        }))
    }, [])

    const updateVizConfig = useCallback((key, value) => {
        setState(prev => ({
            ...prev,
            vizConfig: {
                ...prev.vizConfig,
                [key]: value,
            },
        }))
    }, [])

    const hydrateResult = useCallback((resultPayload, skeletonPayload, benchmarkPayload = null) => {
        const adaptedResult = adaptResult(resultPayload, benchmarkPayload)
        const adaptedSkeleton = adaptSkeletonPage(skeletonPayload, adaptedResult)

        setState(prev => ({
            ...prev,
            status: 'completed',
            jobMeta: {
                ...prev.jobMeta,
                progress: {
                    stage: 'completed',
                    currentStep: 4,
                    totalSteps: 4,
                    ratio: 1,
                },
                error: null,
            },
            result: adaptedResult,
            skeletonPage: adaptedSkeleton,
            benchmarkDetails: benchmarkPayload ?? adaptedResult.benchmark ?? null,
            userMessage: '',
            now: Date.now(),
        }))
    }, [])

    const loadBenchmark = useCallback(async (jobId, runId = runRef.current.runId) => {
        try {
            const benchmarkPayload = await getBenchmark(jobId)
            if (runId !== runRef.current.runId) return

            setState(prev => {
                if (!prev.result) {
                    return {
                        ...prev,
                        benchmarkDetails: benchmarkPayload,
                    }
                }

                const adaptedResult = adaptResult(prev.result.raw, benchmarkPayload)
                return {
                    ...prev,
                    result: adaptedResult,
                    benchmarkDetails: benchmarkPayload,
                    // skeletonPage는 timeseries/repSegments/timelineMarkers에만 의존하며
                    // benchmark 도착 시 변하지 않으므로 재계산 생략
                }
            })
        } catch {
            // Benchmark is optional.
        }
    }, [])

    const pollJob = useCallback(async (jobId, runId, sessionStartedAt) => {
        runRef.current.abortController?.abort()
        runRef.current.abortController = new AbortController()

        try {
            const statusPayload = await getJobStatus(jobId, { signal: runRef.current.abortController.signal })
            if (runId !== runRef.current.runId) return

            runRef.current.pollCount += 1
            const job = adaptJobStatus(statusPayload)

            if (job.rawStatus) {
                markStage(job.rawStatus)
            }

            setState(prev => ({
                ...prev,
                // completed는 result/skeletonPage와 동시에 hydrateResult에서 설정.
                // 여기서 먼저 설정하면 데이터 없는 'completed' 상태가 노출됨.
                ...(job.rawStatus !== 'completed' && { status: job.status }),
                jobMeta: {
                    jobId,
                    progress: job.progress,
                    error: job.error,
                },
                userMessage: job.status === 'error'
                    ? buildUserError({ message: job.error?.message })
                    : '',
                now: Date.now(),
            }))

            if (job.rawStatus === 'completed') {
                clearRun()
                runRef.current.abortController = new AbortController()
                const signal = runRef.current.abortController.signal
                const [resultPayload, skeletonPayload] = await Promise.all([
                    getJobResult(jobId, { signal }),
                    getAllSkeletonPages(jobId, { signal }),
                ])
                if (runId !== runRef.current.runId) return

                markStage('completed')
                hydrateResult(resultPayload, skeletonPayload)
                loadBenchmark(jobId, runId)
                return
            }

            if (job.rawStatus === 'failed') {
                clearRun()
                setState(prev => ({
                    ...prev,
                    status: 'error',
                    userMessage: buildUserError({ message: job.error?.message }),
                }))
                return
            }

            const delay = getPollingDelay({
                pollCount: runRef.current.pollCount,
                startedAt: sessionStartedAt,
            })

            runRef.current.timeoutId = window.setTimeout(() => {
                pollJob(jobId, runId, sessionStartedAt)
            }, delay)
        } catch (error) {
            if (error?.name === 'AbortError' || runId !== runRef.current.runId) return
            clearRun()
            setState(prev => ({
                ...prev,
                status: 'error',
                userMessage: buildUserError(error),
                jobMeta: {
                    ...prev.jobMeta,
                    error: {
                        code: String(error?.status ?? 'network_error'),
                        message: error?.message ?? 'Network error',
                    },
                },
            }))
        }
    }, [clearRun, hydrateResult, loadBenchmark, markStage])

    const startAnalysis = useCallback(async () => {
        const form = state.form

        if (!form.videoFile) {
            setState(prev => ({ ...prev, validationError: 'Upload a source video before starting analysis.' }))
            return
        }

        if (form.exerciseType !== 'squat') {
            setState(prev => ({ ...prev, validationError: 'Only squat is supported in this MVP demo.' }))
            return
        }

        const bodyweightKg = sanitizeNumber(form.bodyweightKg)
        const externalLoadKg = sanitizeNumber(form.externalLoadKg)

        if (bodyweightKg == null || bodyweightKg <= 0) {
            setState(prev => ({ ...prev, validationError: 'Bodyweight must be a positive number.' }))
            return
        }

        if (externalLoadKg == null || externalLoadKg < 0) {
            setState(prev => ({ ...prev, validationError: 'External load must be zero or greater.' }))
            return
        }

        clearRun()
        const runId = runRef.current.runId + 1
        runRef.current.runId = runId
        const sessionStartedAt = Date.now()

        setState(prev => ({
            ...prev,
            status: 'uploading',
            startedAt: sessionStartedAt,
            now: sessionStartedAt,
            validationError: '',
            userMessage: '',
            result: null,
            skeletonPage: null,
            benchmarkDetails: null,
            jobMeta: {
                jobId: null,
                progress: null,
                error: null,
            },
            stageMoments: {
                uploading: sessionStartedAt,
            },
            form: {
                ...prev.form,
                bodyweightKg,
                externalLoadKg,
            },
        }))

        try {
            const payload = await createJob(
                {
                    ...form,
                    bodyweightKg,
                    externalLoadKg,
                },
                form.videoFile
            )
            if (runId !== runRef.current.runId) return

            markStage(payload?.status ?? 'queued')
            setState(prev => ({
                ...prev,
                status: payload?.status ?? 'queued',
                jobMeta: {
                    jobId: payload?.jobId ?? null,
                    progress: payload?.status ? {
                        stage: payload.status,
                        currentStep: 0,
                        totalSteps: 4,
                        ratio: 0,
                    } : null,
                    error: null,
                },
            }))

            if (!payload?.jobId) {
                throw new Error('The backend did not return a jobId.')
            }

            pollJob(payload.jobId, runId, sessionStartedAt)
        } catch (error) {
            if (runId !== runRef.current.runId) return
            clearRun()
            setState(prev => ({
                ...prev,
                status: 'error',
                userMessage: buildUserError(error),
                jobMeta: {
                    ...prev.jobMeta,
                    error: {
                        code: String(error?.status ?? 'request_error'),
                        message: error?.message ?? 'Request error',
                    },
                },
            }))
        }
    }, [clearRun, markStage, pollJob, state.form])

    const downloadRawSkeleton = useCallback(async (jobId = state.jobMeta.jobId) => {
        if (!jobId) {
            throw new Error('Skeleton download is unavailable before a job starts.')
        }

        const { blob, fileName } = await downloadSkeletonFile(jobId)
        const objectUrl = window.URL.createObjectURL(blob)
        const anchor = document.createElement('a')

        anchor.href = objectUrl
        anchor.download = fileName
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()

        window.setTimeout(() => {
            window.URL.revokeObjectURL(objectUrl)
        }, 0)
    }, [state.jobMeta.jobId])

    return {
        ...state,
        isActive: ACTIVE_STATUSES.has(state.status),
        updateForm,
        updateVizConfig,
        startAnalysis,
        downloadRawSkeleton,
        loadBenchmark: () => state.jobMeta.jobId ? loadBenchmark(state.jobMeta.jobId) : Promise.resolve(),
    }
}
