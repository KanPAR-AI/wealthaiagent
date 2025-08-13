# WealthWise Monorepo

A monorepo containing web and mobile applications for WealthWise, built with modern technologies and managed with Turborepo.

## 🏗️ Architecture

- **Web App**: Vite + React + Tailwind CSS v4
- **Mobile App**: Expo + React Native + NativeWind
- **Package Manager**: pnpm
- **Monorepo Tool**: Turborepo
- **Workspace**: pnpm workspaces

## 📁 Project Structure

```
wealthaiagent/
├── apps/
│   ├── web/                 # Vite + React web application
│   └── mobile/              # Expo + React Native mobile app
├── packages/                 # Shared packages (coming soon)
├── scripts/                  # Development and build scripts
├── turbo.json               # Turborepo configuration
├── pnpm-workspace.yaml      # pnpm workspace configuration
└── package.json             # Root package configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- Expo CLI (for mobile development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wealthaiagent
   ```

2. **Setup Turborepo**
   ```bash
   ./scripts/setup-turbo.sh
   ```

3. **Install all dependencies**
   ```bash
   ./scripts/install-all.sh
   ```

4. **Start development**
   ```bash
   ./scripts/dev-all.sh
   ```

## 📱 Available Commands

### Root Level Commands

```bash
# Development
pnpm dev                    # Start all dev servers
pnpm dev:web               # Start web dev server only
pnpm dev:mobile            # Start mobile dev server only

# Build & Test
pnpm build                 # Build all packages
pnpm lint                  # Lint all packages
pnpm test                  # Test all packages
pnpm clean                 # Clean all packages
```

### Turborepo Commands

```bash
# Target specific apps
pnpm turbo dev --filter=wealthaiagent    # Web app only
pnpm turbo dev --filter=mobile           # Mobile app only
pnpm turbo dev --filter=wealthaiagent,mobile  # Both apps

# Build specific apps
pnpm turbo build --filter=wealthaiagent  # Build web only
pnpm turbo build --filter=mobile         # Build mobile only

# Lint specific apps
pnpm turbo lint --filter=wealthaiagent   # Lint web only
pnpm turbo lint --filter=mobile          # Lint mobile only

# Test specific apps
pnpm turbo test --filter=wealthaiagent   # Test web only
pnpm turbo test --filter=mobile          # Test mobile only
```

### Script Commands

```bash
# Setup and installation
./scripts/setup-turbo.sh     # Setup Turborepo
./scripts/install-all.sh     # Install all dependencies
./scripts/check-status.sh    # Check monorepo status

# Development
./scripts/dev-all.sh         # Start all dev servers
./scripts/build-all.sh       # Build all packages
./scripts/test-all.sh        # Test all packages
./scripts/lint-all.sh        # Lint all packages
./scripts/clean-all.sh       # Clean all packages
```

## 🌐 Web Application

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI + custom components
- **State Management**: Zustand
- **Authentication**: Clerk
- **Routing**: React Router DOM

### Web Development

```bash
cd apps/web
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm lint         # Lint code
```

## 📱 Mobile Application

- **Framework**: React Native + Expo
- **Styling**: NativeWind (Tailwind for React Native)
- **Navigation**: Expo Router
- **State Management**: Zustand (coming soon)
- **Authentication**: Clerk (coming soon)

### Mobile Development

```bash
cd apps/mobile
pnpm start        # Start Expo dev server
pnpm android      # Run on Android
pnpm ios          # Run on iOS
pnpm web          # Run in web browser
```

## 🔧 Development Workflow

### Starting Development

1. **Start all services**
   ```bash
   ./scripts/dev-all.sh
   ```

2. **Or start individually**
   ```bash
   # Terminal 1 - Web
   pnpm dev:web
   
   # Terminal 2 - Mobile
   pnpm dev:mobile
   ```

### Building for Production

```bash
# Build all packages
./scripts/build-all.sh

# Or build individually
pnpm turbo build --filter=wealthaiagent  # Web only
```

### Testing

```bash
# Test all packages
./scripts/test-all.sh

# Or test individually
pnpm turbo test --filter=wealthaiagent   # Web only
pnpm turbo test --filter=mobile          # Mobile only
```

## 📦 Package Management

### Adding Dependencies

```bash
# Add to root (dev dependencies)
pnpm add -D <package-name>

# Add to specific app
pnpm add <package-name> --filter=wealthaiagent
pnpm add <package-name> --filter=mobile

# Add to specific app as dev dependency
pnpm add -D <package-name> --filter=wealthaiagent
```

### Workspace Commands

```bash
# Run command in specific workspace
pnpm --filter=wealthaiagent <command>
pnpm --filter=mobile <command>

# Run command in all workspaces
pnpm -r <command>
```

## 🧹 Maintenance

### Cleaning

```bash
# Clean all packages
./scripts/clean-all.sh

# Clean specific packages
pnpm turbo clean --filter=wealthaiagent
pnpm turbo clean --filter=mobile
```

### Status Check

```bash
# Check monorepo status
./scripts/check-status.sh
```

## 🚧 Coming Soon

- [ ] Shared UI component library
- [ ] Common hooks package
- [ ] API client package
- [ ] Shared utilities package
- [ ] Design system tokens
- [ ] Mobile UI implementation

## 🤝 Contributing

1. Follow the monorepo structure
2. Use Turborepo commands for cross-package operations
3. Keep shared logic in packages when possible
4. Test changes across all affected packages

## 📚 Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Expo Documentation](https://docs.expo.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/docs/installation)

## 🐛 Troubleshooting

### Common Issues

1. **Turbo not found**: Run `./scripts/setup-turbo.sh`
2. **Dependencies not linked**: Run `./scripts/install-all.sh`
3. **Build cache issues**: Run `./scripts/clean-all.sh`
4. **Package not found**: Check package names in `--filter` commands

### Getting Help

- Check status: `./scripts/check-status.sh`
- Review Turborepo logs
- Check package.json configurations
- Verify workspace setup
