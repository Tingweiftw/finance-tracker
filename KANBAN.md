# KANBAN - Finance Tracker PWA

## ✅ Done

### Core Setup
- [x] Project initialization (Vite + React + TypeScript)
- [x] Docker & Docker Compose configuration
- [x] PWA manifest and Vite plugin setup
- [x] Mobile-first CSS design system

### Data Models
- [x] Owner model
- [x] Account model (with types: bank, hysa, credit, brokerage, retirement)
- [x] Transaction model (with types: expense, income, investment, transfer)
- [x] Snapshot model

### Services
- [x] Classification service (transaction categorization)
- [x] Ingestion service (CSV import)
- [x] Notification service (push notifications)
- [x] Google Sheets service (CRUD operations)
- [x] CSV parser utility
- [x] PDF parser utility (placeholder)
- [x] Threshold utility (big expense detection)
- [x] Date/currency formatting utilities

### Components
- [x] AccountList
- [x] BigExpenseList
- [x] NetWorthChart
- [x] PassiveIncomeList
- [x] ImportStatusCard

### Pages
- [x] Dashboard
- [x] Import (multi-step flow)
- [x] Net Worth (with owner filter)
- [x] Transactions (with filters and tagging)
- [x] Settings (owner/account management)

### App
- [x] Routing configuration
- [x] Bottom navigation
- [x] State management with mock data

---

## 🔄 In Progress

### PWA Features
- [ ] Service worker implementation
- [ ] Offline caching strategy
- [ ] Push notification integration

---

## 📋 To Do

### Verification
- [ ] Build verification
- [ ] Browser testing
- [ ] Mobile viewport testing

### Documentation
- [ ] Environment variable documentation
- [ ] Google Sheets setup guide

---

## 🚫 Out of Scope

- Budget planning
- Real-time bank syncing
- Tax calculations
- Perfect categorisation
- Double-entry accounting
