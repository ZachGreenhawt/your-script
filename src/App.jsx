import LandingPage from "./components/LandingPage.jsx";
import PracticeApp from "./components/PracticeApp.jsx";
import Dashboard from "./components/Dashboard.jsx";
import FeedbackPage from "./components/FeedbackPage.jsx";

export default function App() {
  const path = window.location.pathname;
  if (path === "/upload") return <PracticeApp />;
  if (path === "/dashboard") return <Dashboard />;
  if (path === "/feedback") return <FeedbackPage />;
  return <LandingPage />;
}
