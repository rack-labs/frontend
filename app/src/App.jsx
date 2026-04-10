import HeroSection from './components/sections/HeroSection/HeroSection.jsx'
import MainHeader from './components/sections/MainHeader/MainHeader.jsx'
import CoreDemoSection from './components/sections/CoreDemoSection/CoreDemoSection.jsx'
import LiveSyncSection from './components/sections/LiveSyncSection/LiveSyncSection.jsx'
import AnalysisDashboard from './components/sections/AnalysisDashboardSection/AnalysisDashboard.jsx'
import TechnicalPipelineSection from './components/sections/TechnicalPipelineSection/TechnicalPipelineSection.jsx'
import Footer from './components/sections/Footer/Footer.jsx'
import ScrollToTopButton from './components/ScrollToTopButton/ScrollToTopButton.jsx'
import { useAnalysisSession } from './features/analysis-session/useAnalysisSession.js'

function App() {
    const analysisSession = useAnalysisSession()

    return (
        <>
            <MainHeader/>
            <HeroSection/>
            <CoreDemoSection analysisSession={analysisSession}/>
            <LiveSyncSection analysisSession={analysisSession}/>
            <AnalysisDashboard analysisSession={analysisSession}/>
            <TechnicalPipelineSection/>
            <Footer/>
            <ScrollToTopButton/>
        </>
    )
}

export default App
