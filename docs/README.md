# API Documentation

## Hosting Instructions

You can host this documentation in multiple ways:

1. **Using Python's Simple HTTP Server**
   ```bash
   cd docs
   python -m http.server 8000
   ```
   Then visit: http://localhost:8000

2. **Using Node's http-server**
   First install: npm install -g http-server
   ```bash
   cd docs
   http-server
   ```
   Then visit: http://localhost:8080

3. **Using any static file hosting service**
   - Upload the contents of this directory to your hosting service
   - Access the index.html file

4. **Using GitHub Pages**
   - Push this docs folder to a GitHub repository
   - Enable GitHub Pages in repository settings
   - Access via: https://[username].github.io/[repo-name]

The documentation will be automatically updated whenever your API changes.