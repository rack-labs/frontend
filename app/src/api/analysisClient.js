const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'

function getBaseUrl() {
    return (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
}

export const DEFAULT_SKELETON_PAGE_LIMIT = 300

async function buildError(response) {
    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text()

    const message = typeof payload === 'string'
        ? payload
        : payload?.detail ?? payload?.error?.message ?? `Request failed with ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    return error
}

async function parseResponse(response) {
    if (!response.ok) {
        throw await buildError(response)
    }

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text()

    return payload
}

async function request(path, init = {}) {
    const response = await fetch(`${getBaseUrl()}${path}`, init)
    return parseResponse(response)
}

function getAttachmentFilename(contentDisposition, fallbackName) {
    if (!contentDisposition) return fallbackName

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1])
    }

    const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
    return asciiMatch?.[1] ?? fallbackName
}

export async function createJob(form, file, { signal } = {}) {
    const body = new FormData()

    if (file) {
        body.append('video', file)
    }

    if (form.samplingFps != null) {
        body.append('samplingFps', String(form.samplingFps))
    }

    body.append('exerciseType', 'squat')

    if (form.bodyweightKg != null) {
        body.append('bodyweightKg', String(form.bodyweightKg))
    }

    if (form.externalLoadKg != null) {
        body.append('externalLoadKg', String(form.externalLoadKg))
    }

    if (form.barPlacementMode) {
        body.append('barPlacementMode', form.barPlacementMode)
    }

    if (form.modelVariant) {
        body.append('modelVariant', form.modelVariant)
    }

    if (form.delegate === 'CPU') {
        body.append('delegate', 'CPU')
    }

    return request('/jobs', {
        method: 'POST',
        body,
        signal,
    })
}

export function getJobStatus(jobId, { signal } = {}) {
    return request(`/jobs/${jobId}`, { signal })
}

export function getJobResult(jobId, { signal } = {}) {
    return request(`/jobs/${jobId}/result`, { signal })
}

export function getSkeletonPage(jobId, offset = 0, limit = DEFAULT_SKELETON_PAGE_LIMIT, { signal } = {}) {
    return request(`/jobs/${jobId}/skeleton?offset=${offset}&limit=${limit}`, { signal })
}

export function getBenchmark(jobId, { signal } = {}) {
    return request(`/jobs/${jobId}/benchmark`, { signal })
}

export async function downloadSkeletonFile(jobId, { signal } = {}) {
    const response = await fetch(`${getBaseUrl()}/jobs/${jobId}/skeleton/download`, { signal })

    if (!response.ok) {
        throw await buildError(response)
    }

    const blob = await response.blob()
    return {
        blob,
        fileName: getAttachmentFilename(
            response.headers.get('content-disposition'),
            `job-${jobId}-skeleton.json`
        ),
    }
}
