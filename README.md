# Kafé Lumière — Milk Tea Shop Management System

A full-stack **Node.js** management system for *Kafé Lumière*, a milk tea shop. Built for the
Advance Web Application final project. Serves three roles — **Customer**, **Cashier**, and **Admin** —
with ordering, cash payments, PDF/emailed receipts, sales reporting, and dashboards.

> Tech: **Node.js + Express + Sequelize (MySQL/MariaDB)** backend and a **jQuery / DataTables /
> Chart.js** frontend with a café theme and purple accents.

---

## Features

**User & roles**
- Customer self-registration, secure login/logout (JWT), password hashing (bcrypt)
- Tokens generated and **saved on the users table**
- Role-based access control middleware (admin / cashier / customer)
- Admin user management: create/edit/delete, change role, activate/deactivate, DataTable listing
- Profile updates, password change, self-deactivation
- Inactive-session timeout

**Products**
- Admin CRUD for products with **image upload** (multer)
- Categories, sizes (with price modifiers), and add-ons management
- Availability toggling

**Ordering**
- Customers and cashiers place orders (drink, size, sugar/ice level, add-ons, quantity)
- Automatic total calculation and unique order number per transaction
- Order status workflow and status updates by staff

**Payments & receipts**
- Cash payment processing with automatic change calculation
- **PDF receipt** generation (PDFKit) with full order details
- Receipt **emailed** to the customer on payment / transaction update (Nodemailer)

**Reports & dashboard**
- Daily / weekly / monthly sales reports (total revenue, transactions, best sellers)
- Export reports to **PDF** and **Excel** (ExcelJS)
- **3 charts** (line, bar, pie) via Chart.js
- Activity log (login, order creation, payment, product updates)

**Frontend extras**
- jQuery validation, search **autocomplete** on the homepage
- **Pagination** (DataTables) and **infinite scroll** (menu)

---

## Project structure

```
backend/
  config/database.js        Sequelize connection
  controllers/              dashboard, item, order, user, transaction
  middleware/               auth (JWT + roles + session timeout), upload (multer)
  models/                   user, category, item, size, addon, order, orderItem, transaction, activityLog, index
  routes/                   user, item, order, transaction, dashboard
  utils/                    token, logger, email, receipt (PDF), seed
  uploads/                  uploaded product images
  app.js                    Express app (routes + static frontend)
  index.js                  server entrypoint (DB sync + listen)
frontend/
  css/style.css
  js/                       app (shared), home, item, cart, order, user, dashboard
  *.html                    home, login, register, profile, deactivate, cart, orders, item, dashboard, user
```

---

## Getting started

### Prerequisites
- Node.js 18+
- MySQL or MariaDB

### 1. Database
```sql
CREATE DATABASE kafe_lumiere CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kafe'@'localhost' IDENTIFIED BY 'kafe_pass123';
GRANT ALL PRIVILEGES ON kafe_lumiere.* TO 'kafe'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Configure & install
```bash
cd backend
cp .env.example .env      # edit DB credentials / JWT secret / SMTP as needed
npm install
```

### 3. Seed demo data (optional but recommended)
```bash
npm run seed
```

### 4. Run
```bash
npm start            # or: npm run dev   (nodemon)
```
Open http://localhost:3000

### Demo accounts (after seeding)
| Role     | Email               | Password    |
|----------|---------------------|-------------|
| Admin    | admin@kafe.test     | admin123    |
| Cashier  | cashier@kafe.test   | cashier123  |
| Customer | customer@kafe.test  | customer123 |

---

## Email configuration

If `SMTP_HOST` is left blank in `.env`, emails are logged via Nodemailer's JSON transport
(the app still works without a real mail server). Set the `SMTP_*` variables to send real emails.

---

## API overview

| Area | Base path |
|------|-----------|
| Auth & users | `/api/users` |
| Products / categories / sizes / add-ons | `/api/items` |
| Orders & receipts | `/api/orders` |
| Transactions (payments) | `/api/transactions` |
| Dashboard, reports, charts, logs | `/api/dashboard` |
