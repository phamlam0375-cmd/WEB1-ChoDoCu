// Cờ build công khai, không phải token. Không phụ thuộc DEV/PROD hay localStorage.
export const isD01DemoEnabled = (env = { VITE_D01_DEMO_MODE: import.meta.env?.VITE_D01_DEMO_MODE }) => env?.VITE_D01_DEMO_MODE === 'true'
