# Subscriber IP Tracking & Monitoring Dashboard

## Overview
This feature tracks IP addresses and session information for all subscribers in real-time, providing admins with a comprehensive monitoring dashboard.

## Features Implemented

### 1. IP Address Tracking
- **Automatic IP Detection**: Captures subscriber IP addresses during login
- **Session Storage**: Stores IP data in Firestore's `sessions` collection
- **Headers Support**: Detects IP from multiple headers:
  - `x-forwarded-for`
  - `x-real-ip`
  - `cf-connecting-ip` (Cloudflare)
  - Direct request IP

### 2. Session Information Captured
Each subscriber session tracks:
- **IP Address**: Geographic location identifier
- **Browser Information**: Automatically detected (Chrome, Firefox, Safari, Edge, Opera)
- **Device Type**: Desktop, Tablet, or Mobile
- **User Agent**: Full browser/device string
- **Login Time**: When the session started
- **Last Activity**: Real-time updates every time session is validated
- **Session Duration**: Calculated time since login
- **User Details**: Email and display name

### 3. Admin Dashboard - "IP Monitor" Tab

#### Summary Cards
- **Active Subscribers**: Green badge showing currently online users (active within 2 minutes)
- **Total Sessions**: Count of all subscriber sessions
- **Unique IPs**: Number of different IP addresses detected

#### Live Sessions Table
Displays comprehensive information for each session:
- **Status Badge**: 
  - Green "Online" with pulsing dot for active sessions
  - Gray "Offline" for inactive sessions
- **Subscriber Info**: Name and email
- **IP Address**: Formatted in monospace font
- **Browser/Device**: Icons and names for easy identification
- **Login Time**: Full timestamp
- **Last Activity**: Relative time (e.g., "5m ago")
- **Session Duration**: Total time since login

#### IP Address Summary
- Groups sessions by unique IP addresses
- Shows active session count per IP
- Displays total sessions per IP
- Easy identification of shared IPs

### 4. Real-Time Updates
- Dashboard updates automatically using Firestore real-time listeners
- No page refresh needed
- Active status updates based on last activity
- Manual refresh button available

## Technical Implementation

### Files Created
1. **`app/api/get-ip/route.ts`**
   - API endpoint to fetch client IP address
   - Supports multiple proxy headers
   - Returns IP in JSON format

2. **`components/admin/subscriber-monitoring.tsx`**
   - Beautiful, illustrated dashboard component
   - Real-time Firestore integration
   - Color-coded status indicators
   - Responsive design

### Files Modified
1. **`lib/auth.ts`**
   - Added `UserSession` interface with IP tracking
   - Updated `createSession()` to capture IP address
   - Added `getUserIpAddress()` helper function
   - Session now stores user email and name

2. **`app/admin/page.tsx`**
   - Added new "IP Monitor" tab
   - Imported `SubscriberMonitoring` component
   - Updated tab layout to 6 columns

## Database Structure

### Firestore Collection: `sessions`
```
sessions/{sessionId}
  - userId: string
  - sessionId: string
  - createdAt: timestamp
  - lastActive: timestamp
  - userAgent: string
  - ipAddress: string
  - userEmail: string (optional)
  - userName: string (optional)
```

## Security & Privacy Considerations

1. **Subscriber Only**: Only subscribers' IPs are tracked (admins and publishers are exempt)
2. **Admin Only Access**: Only users with admin role can view the IP monitoring dashboard
3. **Session Cleanup**: Sessions are automatically deleted when users log out
4. **Single Session Enforcement**: When a subscriber logs in from a new location, the old session (and IP) is replaced

## User Experience

### For Subscribers
- **Transparent**: IP tracking happens automatically during login
- **No Impact**: Zero performance impact on user experience
- **Secure**: Single-session enforcement prevents unauthorized access

### For Admins
- **Easy Navigation**: New "IP Monitor" tab in admin dashboard
- **Visual Indicators**: Color-coded status badges
- **Comprehensive Data**: All relevant session info in one place
- **Real-Time**: Live updates without page refresh
- **Professional UI**: Modern, clean design with icons

## Browser Support
- Chrome 🌐
- Firefox 🦊
- Safari 🧭
- Edge 🔷
- Opera 🎭

## Activity Detection
- Sessions marked as "Online" if active within last 2 minutes
- Activity tracked through periodic session validation (every 30 seconds)
- Automatic transition to "Offline" when inactive

## Benefits

1. **Security Monitoring**: Detect unauthorized access or suspicious IPs
2. **Usage Analytics**: Understand where subscribers are accessing from
3. **Compliance**: Track access for regulatory requirements
4. **Support**: Help subscribers with location-specific issues
5. **Fraud Detection**: Identify unusual access patterns

## Future Enhancements (Possible)
- IP geolocation mapping with visual world map
- Export session data to CSV
- Email alerts for new IP addresses
- Historical session analytics
- IP blocking/whitelisting
- Multi-session warnings

## Single-Session Enforcement (Real-Time)

### How It Works
When a subscriber logs in from a new device/browser:
1. **Immediate Action**: All existing sessions for that user are deleted from Firestore
2. **Real-Time Detection**: The old browser receives instant notification via Firestore listener
3. **User Alert**: An alert message appears: "Your account has been logged in from another device"
4. **Automatic Logout**: The old session is terminated immediately
5. **Response Time**: Typically less than 1 second

### Technical Details
- **Real-Time Monitoring**: Uses Firestore `onSnapshot` listeners (not polling)
- **Instant Detection**: Session deletion triggers immediate callback in all active browsers
- **Backup Validation**: Periodic checks every 30 seconds as fallback
- **Grace Period**: 3-second grace period on first login to avoid false positives

### User Experience
- **Subscriber logs in from Browser A** → Session created
- **Same subscriber logs in from Browser B** → Browser A session deleted
- **Browser A instantly detects** → Shows alert and logs out
- **Only Browser B remains logged in**

### Files Modified for Real-Time Enforcement
- **`hooks/use-auth.tsx`**: Added Firestore real-time listener for session monitoring
- **`lib/auth.ts`**: Enhanced session creation with proper cleanup and logging

## Notes
- IP addresses may show as "unknown" in local development
- Production environments with proper proxies will show accurate IPs
- Session data persists until manual cleanup or logout
- No PII beyond email and display name is stored
- Single-session enforcement is **instant** (not delayed by polling intervals)
- Only affects subscribers - admins and publishers can have multiple sessions

