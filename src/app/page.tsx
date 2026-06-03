const scaffoldItems = [
  "TypeScript Next.js App Router",
  "Prisma + SQLite configuration",
  "Zod dependency for future AI JSON validation",
  "Desktop-first global CSS placeholder"
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">BureauCat MVP v1.2</p>
        <h1 id="page-title">Minimal project scaffold is ready.</h1>
        <p className="lede">
          This smoke-test homepage confirms the App Router shell is running before
          domain features are implemented.
        </p>
      </section>

      <section className="panel" aria-labelledby="included-title">
        <h2 id="included-title">Scaffold includes</h2>
        <ul>
          {scaffoldItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
