import { Link } from "react-router-dom";

export default function NotFound({ message = "This page does not exist." }) {
  return (
    <section className="card center">
      <h1>Not found</h1>
      <p>{message}</p>
      <Link className="btn btn-primary" to="/library">Back to my library</Link>
    </section>
  );
}
