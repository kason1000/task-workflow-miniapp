# Changelog

All notable changes to this project will be documented in this file.

## v1.2 — 2026-04-12

### Summary
Major codebase improvement release. 118 automated tests, component splitting, accessibility, React contexts, and bug fixes.

### Fixed
- **localStorage bug** in GroupDetail.tsx — `localStorage.getItem('userId')` changed to `sessionStorage.getItem('user_id')` (wrong storage type AND wrong key name)
- **Object URL memory leak** — added `revokeObjectURL` cleanup on component unmount for blob media URLs

### Added
- **Error Boundary** component with "Try Again" / "Reload App" fallback UI
- **Test infrastructure**: Vitest with 118 tests (9 test files)
  - i18n tests (locale resolution, translation lookup, interpolation, formatDate)
  - API service tests (response handling, auth headers, URL building, all endpoints)
  - Telegram utility tests (both browser and Telegram environments)
  - LocaleContext tests (provider, persistence, switching)
  - ErrorBoundary tests
  - UserContext / GroupContext tests
  - Type correctness tests
- **UserContext** and **GroupContext** for shared state (eliminates redundant API calls)
- **Component splitting**: extracted 5 new components
  - `TaskFilterBar` — filter/sort controls from TaskList
  - `TaskCard` — individual task card rendering (with `React.memo`)
  - `MediaGrid` — photo/video grid from TaskDetail
  - `TaskActionBar` — status transition buttons from TaskDetail
  - `ThumbnailStrip` — thumbnail row from GalleryOverlay (with `React.memo`)
- **CSS utility classes** — 50+ utility classes, removed duplicate button styles
- **Accessibility**: aria-labels on icon buttons, `role="dialog"` + `aria-modal` on overlays, Escape key handling, `tabIndex` on dialogs
- **Shared utilities**: `statusColors`, `getGroupColor()` extracted to `utils/taskStyles.ts`
- Deploy script now prints version summary and pushes to git remote

---

## v1.1 — 2026-01-27 to 2026-04-12

### Summary
Core miniapp with task list, task detail, gallery, group management, and Telegram Web App integration.

### Features
- Task list with filtering, pagination, status badges
- Task detail with photo/video upload, status transitions
- Fullscreen gallery with pinch-zoom and swipe navigation
- Group management (create, edit, members)
- Browser login screen with 4-digit codes
- i18n support (English, Chinese)
- Media proxying for browser mode
