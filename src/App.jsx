import LandingPage from "./components/LandingPage.jsx";
import PracticeApp from "./components/PracticeApp.jsx";
import Dashboard from "./components/Dashboard.jsx";
import DesignSystem from "./components/DesignSystem.jsx";

export default function App() {
  const path = window.location.pathname;
  if (path === "/upload") return <PracticeApp />;
  if (path === "/dashboard") return <Dashboard />;
  if (path === "/design-system") return <DesignSystem />;
  return <LandingPage />;
}
