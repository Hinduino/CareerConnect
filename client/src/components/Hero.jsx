function Hero({ onJobsClick }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <span className="hero-badge">Find your next opportunity</span>
        <h1>Connect with careers that fit who you are</h1>
        <p>
          CareerConnect brings job seekers and recruiters together in one place.
          Browse open roles, apply with your saved resume, and track every
          application from a single dashboard.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn-primary" onClick={onJobsClick}>
            Browse Jobs
          </button>
        </div>
      </div>
    </section>
  )
}

export default Hero
