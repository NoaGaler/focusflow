import { Link } from "react-router-dom";

export default function NotFound({ message = "העמוד לא נמצא." }) {
  return (
    <section className="card center">
      <h1>לא נמצא</h1>
      <p>{message}</p>
      <Link className="btn btn-primary" to="/library">חזרה לספרייה</Link>
    </section>
  );
}
