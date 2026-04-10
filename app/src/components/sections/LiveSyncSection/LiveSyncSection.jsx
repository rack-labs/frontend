import Panel from '../../Panel/Panel.jsx'
import VisualizationSettings from '../../VisualizationSettings/VisualizationSettings.jsx'
import SkeletonViewer from '../../SkeletonViewer/SkeletonViewer.jsx'
import SectionContainer from '../../SectionContainer/SectionContainer.jsx'
import SettingIcon from '../../../assets/images/icon_setting.png'
import style from './LiveSyncSection.module.css'

export default function LiveSyncSection({ analysisSession }) {
    const {
        form,
        vizConfig,
        skeletonPage,
        status,
        jobMeta,
        userMessage,
        updateVizConfig,
    } = analysisSession
    const canViewVideo = status === 'completed' && Boolean(form.videoFile) && Boolean(skeletonPage)

    return (
        <SectionContainer
            id="liveSyncStudio"
            heading="VISUAL SYNC STUDIO"
            description="Adjust the visualization panel and monitor the live view panel in one workspace before moving into deeper session diagnostics."
        >
            <div className={style.grid}>
                <div className={style.leftColumn}>
                    <Panel icon={SettingIcon} label="Visualization Panel">
                        <VisualizationSettings vizConfig={vizConfig} onChange={updateVizConfig} />
                    </Panel>
                </div>

                <div className={style.rightColumn}>
                    <Panel
                        label="Live View Panel"
                        headerPrefix={
                            <span
                                className={`${style.liveDot} ${canViewVideo ? '' : style.liveDotDisabled}`.trim()}
                                aria-hidden="true"
                            />
                        }
                    >
                        <SkeletonViewer
                            videoFile={form.videoFile}
                            skeletonData={skeletonPage}
                            vizConfig={vizConfig}
                            barPlacementMode={form.barPlacementMode}
                            status={status}
                            jobProgress={jobMeta.progress}
                            errorMessage={userMessage}
                        />
                    </Panel>
                </div>
            </div>
        </SectionContainer>
    )
}
