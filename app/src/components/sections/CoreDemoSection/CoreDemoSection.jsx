import { useEffect, useId, useRef, useState } from 'react'
import Panel from '../../Panel/Panel'
import VideoUpload from '../../VideoUpload/VideoUpload'
import FpsSelector from '../../FpsSelector/FpsSelector'
import Button from '../../Button/Button'
import UploadIcon from '../../../assets/images/icon_ArrowUp.png'
import SettingIcon from '../../../assets/images/icon_setting.png'
import style from './CoreDemoSection.module.css'
import SectionContainer from '../../SectionContainer/SectionContainer'
import { buildProgressSteps, formatStageLabel } from '../../../features/analysis-session/adapters.js'

function formatDuration(ms) {
    if (!ms) return '0.0s'
    return `${(ms / 1000).toFixed(1)}s`
}

function getSegFillWidth(step) {
    if (step.status === 'done') return '100%'
    if (step.status === 'active') {
        // Exponential approach: 빠르게 시작해서 88%에 점근 (T=12s 기준 ~63%@12s, ~86%@24s)
        const raw = (1 - Math.exp(-step.elapsedMs / 12000)) * 88
        return `${Math.max(4, raw).toFixed(2)}%`
    }
    return '0%'
}

function clampNumber(value, min) {
    return Math.max(min, Number(value.toFixed(1)))
}

function getProgressLead(status, hasResult) {
    if (status === 'completed' && hasResult) {
        return 'Analysis completed and synced payloads are available.'
    }

    if (status === 'error') {
        return 'Analysis stopped before completion. Check the error message in the settings panel.'
    }

    if (ACTIVE_PROGRESS_STATUSES.has(status)) {
        return 'Adaptive polling is active and will keep the pipeline view in sync with backend progress.'
    }

    return 'Waiting for a run to start. Progress details will bind to the live job state once analysis begins.'
}

const ACTIVE_PROGRESS_STATUSES = new Set(['uploading', 'queued', 'extracting', 'analyzing', 'computing', 'generating_feedback'])

function ListboxField({ label, value, options, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef(null)
    const listboxId = useId()
    const selectedIndex = options.findIndex((option) => option.value === value)
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0]

    useEffect(() => {
        if (!isOpen) return undefined

        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setIsOpen(false)
            }
        }

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen])

    const moveSelection = (direction) => {
        const fallbackIndex = selectedIndex >= 0 ? selectedIndex : 0
        const nextIndex = (fallbackIndex + direction + options.length) % options.length
        onChange(options[nextIndex].value)
    }

    const handleTriggerKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!isOpen) {
                setIsOpen(true)
                return
            }
            moveSelection(1)
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!isOpen) {
                setIsOpen(true)
                return
            }
            moveSelection(-1)
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setIsOpen(prev => !prev)
        }

        if (event.key === 'Escape') {
            setIsOpen(false)
        }
    }

    return (
        <div className={style.field}>
            <span className={style.fieldLabel}>{label}</span>
            <div className={style.listbox} ref={rootRef}>
                <button
                    type="button"
                    className={`${style.listboxTrigger} ${isOpen ? style.listboxTriggerOpen : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    onClick={() => setIsOpen(prev => !prev)}
                    onKeyDown={handleTriggerKeyDown}
                >
                    <span className={style.listboxValue}>{selectedOption?.label ?? ''}</span>
                    <span className={`${style.selectIcon} ${isOpen ? style.selectIconOpen : ''}`} aria-hidden="true" />
                </button>

                {isOpen && (
                    <div className={style.listboxPopover}>
                        <ul id={listboxId} className={style.listboxOptions} role="listbox" aria-label={label}>
                            {options.map((option) => {
                                const isSelected = option.value === value

                                return (
                                    <li key={option.value} role="presentation">
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            className={`${style.listboxOption} ${isSelected ? style.listboxOptionSelected : ''}`}
                                            onClick={() => {
                                                onChange(option.value)
                                                setIsOpen(false)
                                            }}
                                        >
                                            <span>{option.label}</span>
                                            {isSelected && <span className={style.listboxCheck} aria-hidden="true">Current</span>}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}

function NumberStepperField({ label, value, min, onChange, onStepDown, onStepUp }) {
    return (
        <label className={style.field}>
            <span className={style.fieldLabel}>{label}</span>
            <div className={style.numberField}>
                <input
                    className={`${style.input} ${style.numberInput}`}
                    type="number"
                    min={String(min)}
                    step="0.1"
                    inputMode="decimal"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                <div className={style.stepperInline}>
                    <button
                        type="button"
                        className={style.stepperAction}
                        onClick={onStepDown}
                        aria-label={`Decrease ${label.toLowerCase()}`}
                    >
                        -
                    </button>
                    <span className={style.stepperDivider} />
                    <button
                        type="button"
                        className={style.stepperAction}
                        onClick={onStepUp}
                        aria-label={`Increase ${label.toLowerCase()}`}
                    >
                        +
                    </button>
                </div>
            </div>
        </label>
    )
}

export default function CoreDemoSection({ analysisSession }) {
    const {
        form,
        status,
        vizConfig,
        result,
        skeletonPage,
        jobMeta,
        validationError,
        userMessage,
        stageMoments,
        startedAt,
        now,
        isActive,
        updateForm,
        updateVizConfig,
        startAnalysis,
    } = analysisSession

    const progressSteps = buildProgressSteps(jobMeta.progress, stageMoments, now)
    const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0
    const progressRatio = jobMeta.progress?.ratio ?? (status === 'completed' ? 1 : 0)
    const totalSteps = progressSteps.length
    const currentStep = progressSteps.filter(s => s.status !== 'pending').length
    const progressLead = getProgressLead(status, Boolean(result))
    const hasUploadedVideo = Boolean(form.videoFile)
    const barPlacementOptions = [
        { value: 'auto', label: 'auto' },
        { value: 'high_bar', label: 'high_bar' },
        { value: 'low_bar', label: 'low_bar' },
    ]
    const modelVariantOptions = [
        { value: 'lite', label: 'lite' },
        { value: 'full', label: 'full' },
        { value: 'heavy', label: 'heavy' },
    ]

    const adjustNumericField = (key, delta, min) => {
        const currentValue = Number(form[key])
        const nextValue = Number.isFinite(currentValue)
            ? clampNumber(currentValue + delta, min)
            : min

        updateForm(key, nextValue)
    }

    return (
        <SectionContainer
            id="coreDemo"
            heading='CORE DEMO'
            description='Upload your video, run the async analysis session, and inspect the live skeleton sync against the original source file.'
        >
            <div className={style.contents}>
                <div className={style.primaryGrid}>
                    <Panel icon={UploadIcon} label="Analysis Settings" id="analysisSettingsPanel" tabIndex={-1} containerClassName={hasUploadedVideo ? style.settingsPanelExpanded : ''}>
                        <div className={style.panelContent}>
                            <VideoUpload file={form.videoFile} onFileSelect={(file) => updateForm('videoFile', file)} />
                            {hasUploadedVideo && (
                                <div className={style.uploadDetails}>
                                    <FpsSelector value={form.samplingFps} onChange={(value) => updateForm('samplingFps', value)} />

                                    <div className={style.formGrid}>
                                        <label className={style.field}>
                                            <span className={style.fieldLabel}>Exercise Type</span>
                                            <input className={style.input} value="squat (demo only)" disabled />
                                        </label>
                                        <ListboxField
                                            label="Bar Placement"
                                            value={form.barPlacementMode}
                                            options={barPlacementOptions}
                                            onChange={(nextValue) => updateForm('barPlacementMode', nextValue)}
                                        />
                                        <NumberStepperField
                                            label="Bodyweight (kg)"
                                            value={form.bodyweightKg}
                                            min={1}
                                            onChange={(nextValue) => updateForm('bodyweightKg', nextValue)}
                                            onStepDown={() => adjustNumericField('bodyweightKg', -0.1, 1)}
                                            onStepUp={() => adjustNumericField('bodyweightKg', 0.1, 1)}
                                        />
                                        <NumberStepperField
                                            label="External Load (kg)"
                                            value={form.externalLoadKg}
                                            min={0}
                                            onChange={(nextValue) => updateForm('externalLoadKg', nextValue)}
                                            onStepDown={() => adjustNumericField('externalLoadKg', -0.1, 0)}
                                            onStepUp={() => adjustNumericField('externalLoadKg', 0.1, 0)}
                                        />
                                        <ListboxField
                                            label="Model Variant"
                                            value={form.modelVariant}
                                            options={modelVariantOptions}
                                            onChange={(nextValue) => updateForm('modelVariant', nextValue)}
                                        />
                                        <label className={style.field}>
                                            <span className={style.fieldLabel}>Delegate</span>
                                            <div className={style.inlineOptions}>
                                                <button type="button" className={`${style.optionButton} ${form.delegate === 'CPU' ? style.optionButtonActive : ''}`}>
                                                    CPU
                                                </button>
                                                <button type="button" className={style.optionButtonDisabled} disabled>
                                                    GPU unsupported
                                                </button>
                                            </div>
                                        </label>
                                        <label className={`${style.field} ${style.fullWidth}`}>
                                            <span className={style.fieldLabel}>Model Asset Path</span>
                                            <input className={style.input} value="Unsupported in MVP v1 demo" disabled />
                                        </label>
                                    </div>

                                    {(validationError || userMessage) && (
                                        <div className={style.errorBox}>
                                            {validationError || userMessage}
                                        </div>
                                    )}

                                    <Button
                                        label={isActive ? 'Analyzing...' : status === 'completed' ? 'Re-run Analysis' : 'Start Analysis'}
                                        width="100%"
                                        height="5.2rem"
                                        onClick={startAnalysis}
                                        disabled={isActive || !form.videoFile}
                                    />
                                </div>
                            )}
                        </div>
                    </Panel>

                    <Panel icon={SettingIcon} label="Pipeline Progress" containerClassName={style.progressPanelContainer} bodyClassName={style.progressPanelBody}>
                        {!hasUploadedVideo ? (
                            <div className={style.progressPanel}>
                                <div className={style.ppStatusRow}>
                                    <div className={style.ppBadge} data-state="idle">
                                        <span className={style.ppBadgeDot} />
                                        <span>Idle</span>
                                    </div>
                                    <div className={style.ppMeta}>
                                        <span>—</span>
                                        <span>0.0s</span>
                                        <span>0 / 7</span>
                                    </div>
                                </div>

                                <p className={style.ppHint}>Upload a video to activate live job polling and stage-by-stage pipeline updates.</p>

                                <svg className={style.ppSegBar} viewBox="0 0 140 140" width="100%" height="100%" aria-hidden="true">
                                    {['Upload', 'Queue', 'Extract', 'Pose', 'Biomech', 'Feedback', 'Done'].map((label, i, arr) => {
                                        const r = 62, total = arr.length
                                        const segLen = (2 * Math.PI * r) * ((360 / total - 10) / 360)
                                        const dashGap = (2 * Math.PI * r) - segLen
                                        return (
                                            <circle
                                                key={label}
                                                className={style.ppSeg}
                                                data-state="idle"
                                                cx="70" cy="70" r={r}
                                                fill="none"
                                                strokeDasharray={`${segLen.toFixed(2)} ${dashGap.toFixed(2)}`}
                                                style={{ transform: `rotate(${-90 + (360 / total) * i}deg)`, transformOrigin: '70px 70px' }}
                                            />
                                        )
                                    })}
                                </svg>

                                <ol className={style.ppSteps}>
                                    {['Upload started', 'Queued', 'Frame extraction', 'Pose inference', 'Biomechanical analysis', 'Feedback generation', 'Completed'].map((label, i, arr) => (
                                        <li key={label} className={style.ppStep} data-state="idle">
                                            <div className={style.ppStepIndicator}>
                                                <span className={style.ppStepNum}>{i + 1}</span>
                                                {i < arr.length - 1 && <span className={style.ppStepLine} />}
                                            </div>
                                            <div className={style.ppStepBody}>
                                                <span className={style.ppStepLabel}>{label}</span>
                                                <span className={style.ppStepTime}>—</span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ) : (
                            <div className={style.progressPanel}>
                                <div className={style.ppStatusRow}>
                                    <div
                                        className={style.ppBadge}
                                        data-state={isActive ? 'active' : status === 'completed' ? 'done' : status === 'error' ? 'error' : 'idle'}
                                    >
                                        <span className={style.ppBadgeDot} />
                                        <span>{formatStageLabel(jobMeta.progress?.stage ?? status)}</span>
                                    </div>
                                    <div className={style.ppMeta}>
                                        <span>{jobMeta.jobId ? `#${String(jobMeta.jobId).slice(-6)}` : '—'}</span>
                                        <span>{formatDuration(elapsedMs)}</span>
                                        <span>{currentStep} / {totalSteps}</span>
                                    </div>
                                </div>

                                <svg className={style.ppSegBar} viewBox="0 0 140 140" width="100%" height="100%" aria-hidden="true">
                                    {progressSteps.map((step, i) => {
                                        const r = 62, total = progressSteps.length
                                        const segLen = (2 * Math.PI * r) * ((360 / total - 10) / 360)
                                        const dashGap = (2 * Math.PI * r) - segLen
                                        return (
                                            <circle
                                                key={step.key}
                                                className={style.ppSeg}
                                                data-state={step.status}
                                                cx="70" cy="70" r={r}
                                                fill="none"
                                                strokeDasharray={`${segLen.toFixed(2)} ${dashGap.toFixed(2)}`}
                                                style={{ transform: `rotate(${-90 + (360 / total) * i}deg)`, transformOrigin: '70px 70px' }}
                                            />
                                        )
                                    })}
                                </svg>

                                <ol className={style.ppSteps}>
                                    {progressSteps.map((step, i) => (
                                        <li key={step.key} className={style.ppStep} data-state={step.status}>
                                            <div className={style.ppStepIndicator}>
                                                <span className={style.ppStepNum}>
                                                    {step.status === 'done' ? '✓' : i + 1}
                                                </span>
                                                {i < progressSteps.length - 1 && <span className={style.ppStepLine} />}
                                            </div>
                                            <div className={style.ppStepBody}>
                                                <span className={style.ppStepLabel}>{step.label}</span>
                                                <span className={style.ppStepTime}>
                                                    {step.status !== 'pending' ? formatDuration(step.elapsedMs) : '—'}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>

                                {result?.summary && (
                                    <div className={style.ppFacts}>
                                        <span>
                                            <span className={style.ppFactLabel}>Reps</span>
                                            <strong className={style.ppFactValue}>{result.summary.repCount ?? '—'}</strong>
                                        </span>
                                        <span>
                                            <span className={style.ppFactLabel}>Detection</span>
                                            <strong className={style.ppFactValue}>{result.summary.detectionRatio != null ? `${Math.round(result.summary.detectionRatio * 100)}%` : '—'}</strong>
                                        </span>
                                        <span>
                                            <span className={style.ppFactLabel}>Sampled FPS</span>
                                            <strong className={style.ppFactValue}>{result.summary.sampledFps != null ? Number(result.summary.sampledFps).toFixed(3) : skeletonPage?.fps != null ? Number(skeletonPage.fps).toFixed(3) : '—'}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </Panel>
                </div>
            </div>
        </SectionContainer>
    )
}
