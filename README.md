# Perfume MERN Assignment Scaffold

This scaffold provides models, routes, and a simple Express server to implement the assignment requirements.

Quick start:

1. cd test
2. npm install express mongoose body-parser bcrypt jsonwebtoken
3. Set environment variables as needed (MONGO_URI, JWT_SECRET)
4. npm start (or node app.js)

Routes:
- POST /api/auth/register
- POST /api/auth/login
- GET /api/perfumes
- GET /api/perfumes/:id
- Admin-only CRUD on /api/perfumes
- GET /api/members (Admin only)
- GET /api/members/me, PUT /api/members/me, PUT /api/members/me/password

Admin endpoints added:
- POST /api/auth/register/admin (Admin only) - create a member and optionally set isAdmin
- PUT /api/members/:id/admin (Admin only) - set { isAdmin: true|false } to promote/demote

Notes:
- Public registration (/api/auth/register) will ignore any isAdmin field.
- Member responses never include the password field.

Notes:
- Passwords are hashed using bcrypt before save.
- Token-based auth using JWT. Token must be sent in Authorization: Bearer <token>
