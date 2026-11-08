import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="hero">
      <h1>לומדים מסרטון? אל תפספסו אף רגע.</h1>
      <p className="lead">
        FocusFlow מודד את הקשב שלכם דרך המצלמה בזמן שאתם צופים בסרטון YouTube או קוראים טקסט.
        כשהריכוז יורד, האתר מסמן את הרגע ומציע <strong>לחזור בדיוק לנקודה שבה איבדתם את החוט</strong>.
      </p>
      <div className="hero-actions">
        <Link to="/register" className="btn btn-primary btn-lg">הרשמה בחינם</Link>
        <Link to="/login" className="btn btn-ghost btn-lg">כבר יש לי חשבון</Link>
      </div>
      <ol className="steps">
        <li><strong>1. מוסיפים תוכן</strong><span>קישור לסרטון YouTube או טקסט שרוצים לקרוא.</span></li>
        <li><strong>2. מתחילים סשן</strong><span>מאשרים מצלמה. כל 5 שניות מתעדכן ציון קשב.</span></li>
        <li><strong>3. חוזרים למה שפספסתם</strong><span>פס צבעוני מראה איפה הייתם מרוכזים, ונקודות חזרה מחזירות אתכם לרגע הנכון.</span></li>
      </ol>
    </section>
  );
}
