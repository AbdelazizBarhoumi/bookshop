# 📚 RIC Library - Point of Sale (POS) System

<div align="center">

![RIC Library](https://img.shields.io/badge/RIC_Library-POS_System-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)

A modern, full-featured Point of Sale system designed specifically for bookshops and stationery stores. Built with React, TypeScript, and Electron for a seamless cross-platform desktop experience.

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [Usage](#-usage) • [Screenshots](#-screenshots)

</div>

---

## ✨ Features

### 🛒 Point of Sale
- **Fast checkout** with barcode scanning support
- **Cart management** with quantity adjustments and item-level discounts
- **Multiple payment methods** (Cash, Card, Mobile payments - Bankak, Fawry, Ocash)
- **Print job services** (B&W/Color printing, binding options)
- **Receipt generation** with PDF export

### 📦 Inventory Management
- **Product catalog** with categories (Books, Writing instruments, Paper, Services)
- **Custom categories** support
- **Stock tracking** with low stock alerts
- **Batch stock updates** with history logging
- **Barcode/ISBN support** for quick product lookup

### 👥 Customer Management
- **Customer database** with contact information
- **Loyalty points system** with redemption
- **Purchase history** tracking
- **Customer-specific discounts**

### 🏢 Supplier Management
- **Supplier directory** with contact details
- **Product-supplier association**
- **Order tracking**

### 💰 Financial Management
- **Expense tracking** with categories
- **Payment status** (Paid, Pending, Overdue)
- **Net profit calculations** including COGS and expenses
- **Transaction history** with refund support

### 📊 Reports & Analytics
- **Dashboard** with key metrics and visualizations
- **Revenue charts** (daily, weekly, monthly trends)
- **Category-wise sales breakdown**
- **Top-selling products** report
- **Export to PDF and CSV**

### ⚙️ Settings & Security
- **Multi-user support** with role-based access (Owner, Manager, Cashier)
- **Audit logging** for tracking changes
- **Dark/Light theme** support
- **Bilingual interface** (English & Arabic with RTL support)
- **Data backup & restore**

---

## 🛠️ Tech Stack

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=flat-square&logo=sqlite&logoColor=white)

</div>

| Category | Technologies |
|----------|--------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **Build Tool** | Vite with SWC |
| **Desktop Framework** | Electron 40 |
| **Database** | better-sqlite3 (embedded SQLite) |
| **UI Components** | Radix UI, shadcn/ui |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Forms** | React Hook Form, Zod validation |
| **State Management** | TanStack React Query |
| **PDF Generation** | jsPDF, jspdf-autotable |
| **CSV Export** | PapaParse |
| **Date Handling** | date-fns |
| **Routing** | React Router DOM |

---

## 📦 Installation

### Prerequisites
- **Node.js** 18.x or higher
- **npm** 9.x or higher (or yarn/pnpm)

### Clone the Repository

```bash
git clone https://github.com/yourusername/ric-library.git
cd ric-library
```

### Install Dependencies

```bash
npm install
```

### Development Mode

Run the application in development mode with hot-reload:

```bash
npm run dev
```

This starts the Vite dev server and opens the Electron window.

### Build for Production

Build the application for distribution:

```bash
# Build web assets
npm run build

# Build Electron executable (Windows)
npm run electron:build
```

The packaged application will be available in the `release` directory.

---

## 🚀 Usage

### Default Credentials

On first launch, demo data is seeded with a default owner account:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | Owner |

> ⚠️ **Important:** Change the default password immediately after first login!

### Navigation

The application features a sidebar navigation with the following sections:

- **Dashboard** - Overview of sales, inventory, and alerts
- **Products** - Manage product catalog
- **Inventory** - Stock management and adjustments
- **Point of Sale** - Process transactions
- **Transactions** - View and manage sales history
- **Customers** - Customer database and loyalty
- **Suppliers** - Supplier management
- **Expenses** - Track business expenses
- **Reports** - Analytics and exports
- **Settings** - App configuration and user management

### Role Permissions

| Feature | Owner | Manager | Cashier |
|---------|:-----:|:-------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ |
| Point of Sale | ✅ | ✅ | ✅ |
| Transactions | ✅ | ✅ | ✅ |
| Products | ✅ | ✅ | ❌ |
| Inventory | ✅ | ✅ | ❌ |
| Customers | ✅ | ✅ | ✅ |
| Suppliers | ✅ | ✅ | ❌ |
| Expenses | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Settings | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ |

---

## 📸 Screenshots

<div align="center">

### Dashboard
*Business overview with key metrics and charts*
![Dashboard Screenshot](screenshots/dashboard.png)

### Point of Sale
*Fast and intuitive checkout interface*
![POS Screenshot](screenshots/pos.png)

### Inventory Management
*Track stock levels and manage products*
![Inventory Screenshot](screenshots/inventory.png)

### Reports
*Comprehensive business analytics*
![Reports Screenshot](screenshots/reports.png)

> 📌 **Note:** Add your screenshots to the `screenshots/` folder

</div>

---

## 📁 Project Structure

```
ric-library/
├── public/                  # Static assets
│   └── icon.png            # App icon
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── AppLayout.tsx  # Main layout wrapper
│   │   ├── NavLink.tsx    # Navigation component
│   │   └── ProtectedRoute.tsx
│   ├── electron/          # Electron main process
│   │   ├── main.ts        # Main entry point
│   │   ├── preload.ts     # Preload script
│   │   ├── database.ts    # SQLite operations
│   │   ├── auth.ts        # Authentication logic
│   │   └── emailService.ts
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and helpers
│   │   ├── auth.tsx       # Auth context
│   │   ├── dataStore.tsx  # Data management
│   │   ├── i18n.ts        # Internationalization
│   │   ├── pdf.ts         # PDF generation
│   │   ├── csv.ts         # CSV export
│   │   └── storage.ts     # Storage utilities
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Products.tsx
│   │   ├── Inventory.tsx
│   │   ├── PointOfSale.tsx
│   │   ├── Transactions.tsx
│   │   ├── Customers.tsx
│   │   ├── Suppliers.tsx
│   │   ├── Expenses.tsx
│   │   ├── Reports.tsx
│   │   ├── Settings.tsx
│   │   └── Login.tsx
│   ├── types/             # TypeScript types
│   │   └── pos.ts         # Domain types
│   ├── App.tsx            # Root component
│   └── main.tsx           # React entry point
├── dist/                   # Built web assets
├── dist-electron/          # Built Electron files
├── release/                # Packaged application
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 🧪 Testing

Run the test suite:

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch
```

---

## 🔧 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run build:dev` | Build for development |
| `npm run electron:dev` | Start Electron in dev mode |
| `npm run electron:build` | Package Electron app |
| `npm run lint` | Run ESLint |
| `npm run types` | TypeScript type checking |
| `npm run test` | Run tests |
| `npm run clean` | Clean build artifacts |

---

## 🌐 Internationalization

The application supports multiple languages:

- 🇺🇸 **English** (default)
- 🇸🇦 **Arabic** (with RTL support)

Language can be changed in **Settings > General > Language**.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Abdelaziz Barhoumi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

**Made with ❤️ by [Abdelaziz Barhoumi](https://github.com/AbdelazizBarhoumi)**

</div>
