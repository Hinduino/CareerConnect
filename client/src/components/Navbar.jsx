function Navbar() {
  return (
    <header className="navbar-section">
      <nav className="navbar-container">
        {/* we can potentially add our logo here */}
        <div className="navbar-brand">
          <h2>CareerConnect</h2>
        </div>

        {/* Navigation Links, we can change/add more */}
        <ul className="navbar-links">
          <li><a href="#browse-jobs">Browse Jobs</a></li>
          <li><a href="#features">Features</a></li>
        </ul>

        {/* Account sign up/ login buttons */}
        <div className="navbar-actions">
          <button type="button">Log In</button>
          <button type="button">Sign Up</button>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
