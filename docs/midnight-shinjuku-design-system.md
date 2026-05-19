# Midnight Shinjuku Design System

Google Stitch から受け取った V2 デザイン定義の保管用メモ。

## Colors

- Background: `#0e0e0e`
- Primary: `#00d1ff`
- Secondary: `#b630ff`
- Text main: `#ffffff`
- Text body: `#e0e0e0`
- Text muted: `#a0a0a0`
- Border: `rgba(255, 255, 255, 0.1)`
- Success: `#00ffa3`
- Error: `#ff4b4b`
- Warning: `#ffb800`

## Typography

- H1: `32px`, weight `700`, line-height `1.2`
- H2: `20px`, weight `600`, line-height `1.4`
- Body: `14px`, weight `400`, line-height `1.6`
- Caption: `12px`, weight `400`, line-height `1.5`
- Font family: `Inter`, system sans-serif fallback

## Layout

- Mobile target width: `375px` to `430px`
- Desktop container max width: `1200px`
- Container padding: `20px`
- Section gap: `40px`
- Card padding: `24px`
- Button height: `56px`

## Components

- Card: glassmorphism, radius `24px`
- Primary button: blue-to-purple gradient, white text, radius `999px`
- Secondary button: transparent background, 1px border, radius `999px`
- Input: `rgba(255,255,255,0.05)` background with 1px border
- Status: success uses neon blue/green, error uses red accent

## Glassmorphism

```css
background: rgba(28, 27, 27, 0.7);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
border-radius: 24px;
```
