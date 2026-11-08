import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="hero">
      <h1>Learning from a video? Don't miss a moment.</h1>
      <p className="lead">
        FocusFlow measures your attention through the webcam while you watch a YouTube video or read a text.
        When your focus drops, it marks the moment and offers to <strong>take you back exactly to where you drifted</strong>.
      </p>
      <div className="hero-actions">
        <Link to="/register" className="btn btn-primary btn-lg">Sign up for free</Link>
        <Link to="/login" className="btn btn-ghost btn-lg">I already have an account</Link>
      </div>
      <ol className="steps">
        <li><strong>1. Add content</strong><span>A YouTube link or a text you want to read.</span></li>
        <li><strong>2. Start a session</strong><span>Allow the camera. Your attention score updates every 5 seconds.</span></li>
        <li><strong>3. Rewind what you missed</strong><span>A colored bar shows where you were focused, and rewind points take you back to the right moment.</span></li>
      </ol>
    </section>
  );
}
