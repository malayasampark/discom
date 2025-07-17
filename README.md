# Consumer OTP API with CIS Integration

A Node.js Express API for consumer OTP generation and verification integrated with Customer Information System (CIS) for utility companies.

## Features

- ✅ **CIS Consumer Validation**: Validates consumers from existing CIS database
- ✅ **Secure OTP Generation**: 6-digit cryptographically secure OTP
- ✅ **Complete Consumer Data**: Returns consumer, account, and meter information
- ✅ **Rate Limiting**: Protection against spam and brute force attacks
- ✅ **Input Validation**: Comprehensive request validation using express-validator
- ✅ **Database Integration**: PostgreSQL with connection pooling
- ✅ **Security Headers**: Helmet.js for security headers
- ✅ **Webhook Integration**: Automatic OTP delivery via webhook
- ✅ **Request Tracking**: UUID-based request tracking
- ✅ **Comprehensive Logging**: Structured logging with log4js

## API Endpoints

### 1. Generate OTP
**POST** `/api/generateOTP`

Generates OTP for a consumer after validating from CIS database.

**Request Body:**
```json
{
  "emailAddress": "user@example.com"
}
```
OR
```json
{
  "mobileNumber": "9876543210"
}
```

**Response:**
```json
{
  "hasError": false,
  "errorCode": null,
  "message": "OTP has been sent to user@example.com. Please check your email.",
  "requestId": "uuid-here",
  "data": {
    "consumer": {
      "consumer_number": "CONS001",
      "consumer_name": "John Doe",
      "consumer_type": "residential",
      "mobile_no": "9876543210",
      "email_address": "user@example.com",
      "address_line1": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "circle": "Western",
      "division": "Mumbai Central",
      "sub_division": "Bandra",
      "status": "active"
    },
    "accounts": [
      {
        "account_id": "ACC001",
        "consumer_number": "CONS001",
        "account_status": "active",
        "connection_type": "permanent",
        "connection_status": "connected",
        "meter_number": "MTR001",
        "sanctioned_load": 5.00,
        "tariff_category": "Residential",
        "billing_cycle": "monthly",
        "meter_type": "single_phase",
        "manufacturer": "Schneider Electric",
        "model": "EM6400",
        "installation_date": "2024-01-15",
        "meter_status": "active"
      }
    ]
  }
}
```

### 2. Verify OTP
**POST** `/api/verifyOTP`

Verifies the OTP for a consumer.

**Request Body:**
```json
{
  "emailAddress": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "hasError": false,
  "errorCode": null,
  "message": "OTP verified successfully",
  "requestId": "uuid-here",
  "data": {
    "consumer": {
      "consumer_number": "CONS001",
      "consumer_name": "John Doe",
      // ... complete consumer data
    },
    "accounts": [
      {
        "account_id": "ACC001",
        // ... complete account and meter data
      }
    ]
  }
}
```

## Required Headers

All API requests must include:
- `authorization`: Bearer token or API key
- `content-type`: application/json
- `user-agent`: Client identifier

## Database Schema

### Core Tables Used

#### `cis.consumers`
- Consumer master data from CIS
- Validated against email/mobile for OTP generation

#### `cis.consumer_accounts`
- Account information linking consumers to meters
- Returned in API response

#### `cis.smart_meters`
- Smart meter information
- Joined with account data in response

#### `otp_verifications`
- Stores OTP data with consumer linkage
- Handles OTP expiration and usage tracking

## Environment Variables

```env
# Database Configuration
DB_USER=your_db_user
DB_HOST=localhost
DB_NAME=your_db_name
DB_PASSWORD=your_db_password
DB_PORT=5432

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key
OTP_EXPIRY_MINUTES=5

# Rate Limiting
API_RATE_LIMIT_WINDOW_MINUTES=15
API_RATE_LIMIT_MAX_REQUESTS=100
OTP_RATE_LIMIT_WINDOW_MINUTES=1
OTP_RATE_LIMIT_MAX_REQUESTS=3

# Webhook Configuration
WEBHOOK_URL=https://your-webhook-url.com/webhook

# Application
NODE_ENV=development
PORT=3000
```

## Business Flow

1. **Consumer Validation**: System validates email/mobile against CIS database
2. **Status Check**: Only active consumers can generate OTP
3. **OTP Generation**: 6-digit OTP generated and stored with consumer linkage
4. **Webhook Delivery**: OTP sent to configured webhook URL
5. **Data Response**: Complete consumer, account, and meter data returned
6. **OTP Verification**: Consumer can verify OTP to complete authentication

## Security Features

### Rate Limiting
- **API Rate Limit**: 100 requests per 15 minutes per IP
- **OTP Rate Limit**: 3 requests per 1 minute per IP

### Input Validation
- Email format validation
- Mobile number format validation (10-15 digits)
- Required header validation
- Request body sanitization

### OTP Security
- 6-digit cryptographically secure OTP
- Expiration time (default: 5 minutes)
- One-time use only
- Automatic invalidation of previous OTPs

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `RATE_LIMIT` | Rate limit exceeded |
| `CONSUMER_NOT_FOUND` | Consumer not found in CIS |
| `CONSUMER_INACTIVE` | Consumer status is not active |
| `INVALID_OTP` | OTP is invalid or expired |
| `OTP_GENERATION_ERROR` | Error generating OTP |
| `VERIFY_OTP_ERROR` | Error verifying OTP |

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env`
4. Create database and run schema:
   ```bash
   psql -U your_user -d your_database -f schema.sql
   ```
5. Start the application:
   ```bash
   npm start
   ```

## API Usage Examples

### Generate OTP
```bash
curl -X POST http://localhost:3000/api/generateOTP \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -H "User-Agent: MyApp/1.0" \
  -d '{"emailAddress": "user@example.com"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:3000/api/verifyOTP \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -H "User-Agent: MyApp/1.0" \
  -d '{"emailAddress": "user@example.com", "otp": "123456"}'
```

## Data Response Structure

The API returns comprehensive data including:
- **Consumer Information**: Name, type, contact details, address
- **Account Details**: Account status, connection type, billing cycle
- **Meter Information**: Meter type, manufacturer, model, installation date
- **Administrative Data**: Circle, division, sub-division assignments

This provides a complete view of the consumer's utility connection and account status.

## Health Check

**GET** `/health`

Returns server health status and version information.

## Logging

Logs are written to:
- Console (development)
- File: `logs/app.log` (production)

Log levels:
- Development: `debug`
- Production: `warn`

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database
3. Set up proper CORS origins
4. Use PM2 or similar for process management
5. Set up proper SSL/TLS termination
6. Configure log rotation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

ISC License
