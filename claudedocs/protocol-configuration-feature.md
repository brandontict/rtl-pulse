# Protocol Configuration Feature

## Overview
Added a comprehensive protocol selector and program flags configuration UI to the RTL-SDR Dashboard.

## Components Created

### 1. ProtocolSelector (`dashboard/src/components/ProtocolSelector.tsx`)
Multi-select dropdown for rtl_433's 291 supported protocols.

**Features:**
- Search by name, ID, or description
- Category filtering (temperature, weather, TPMS, security, remote, power, water, smoke, doorbell, automotive, appliance, other)
- Select/deselect all visible protocols
- Category quick-select buttons with selection count
- Expandable protocol list with checkboxes
- Selected protocols summary with individual remove buttons
- Lazy loading states

### 2. FlagsConfig (`dashboard/src/components/FlagsConfig.tsx`)
Program flags configuration panel for rtl_433 command-line options.

**Flag Groups:**
- **Core Settings**: frequency, sample_rate, gain, device
- **Output Configuration**: output_json, output_mqtt, mqtt_host, mqtt_port, mqtt_retain
- **Processing Options**: convert, analyze_mode, verbose, quiet

**Input Types Supported:**
- `text` - Text input with examples
- `number` - Range slider + numeric input
- `boolean` - Toggle switch
- `select` - Single-select dropdown
- `multiselect` - Multi-button selection

**Special Features:**
- Preset frequency buttons for common regions (433.92M, 315M, 868M, 915M, etc.)
- Reset to defaults functionality
- Expandable info panels for each flag

### 3. Configuration Page (`dashboard/src/pages/Configuration.tsx`)
Full-page configuration interface combining both components.

**Features:**
- Two-column layout (protocols left, flags right)
- "Generate Config" button calling backend API
- Generated config preview with syntax highlighting
- Copy to clipboard functionality
- Download as `rtl_433.conf` file
- Quick stats dashboard (protocols selected, frequency, gain, sample rate)

## Backend Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/signals/protocols` | GET | Fetch all 291 protocols with category/search filtering |
| `/api/v1/signals/protocols/categories` | GET | Fetch protocol categories with counts |
| `/api/v1/signals/flags` | GET | Fetch all program flags with metadata |
| `/api/v1/signals/frequencies` | GET | Fetch common frequencies by region |
| `/api/v1/signals/config/generate` | POST | Generate rtl_433.conf from selections |

## Types Added (`dashboard/src/types/index.ts`)

```typescript
interface Protocol {
  id: number
  name: string
  category: string
  desc: string
}

interface ProtocolCategory {
  id: string
  name: string
  count: number
}

interface ProgramFlag {
  flag: string
  name: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'protocol'
  default: unknown
  desc: string
  min?: number
  max?: number
  options?: string[]
  examples?: string[]
}

interface Frequency {
  frequency: string
  region: string
  common_uses: string
}
```

## Navigation
Added to App.tsx:
- Route: `/config`
- Nav label: "Configuration"
- Icon: `Cpu` from lucide-react

## Usage
1. Navigate to Configuration page via navbar
2. Search/filter and select desired protocols
3. Configure program flags (frequency, gain, output settings)
4. Click "Generate Config" to create rtl_433.conf
5. Copy or download the generated configuration

## File Locations
```
dashboard/src/
├── components/
│   ├── ProtocolSelector.tsx   # Protocol multi-select
│   └── FlagsConfig.tsx        # Program flags UI
├── pages/
│   └── Configuration.tsx      # Main config page
├── services/
│   └── api.ts                 # API methods (updated)
└── types/
    └── index.ts               # TypeScript types (updated)
```

## Dependencies
- lucide-react (icons)
- React hooks (useState, useEffect, useMemo)
- Existing api service

## Styling
- Dark theme (slate-800/900 backgrounds)
- Blue accent color for selections and primary actions
- Responsive grid layout (lg:grid-cols-2)
- TailwindCSS utility classes
