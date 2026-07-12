# ✨ FancyAlt

FancyAlt is an accessibility-focused web application and API that uses OpenAI to turn images into clear, useful text.

Users can upload an image or provide a public image URL, choose one result type, and receive that requested output: concise alt text, a detailed description, a social media description, a short creative story, or an image safety check.

**🌐 Live Web App:** [https://fancyalt.com](https://fancyalt.com)

**📚 Interactive API Documentation:** [https://fancyalt.com/api-docs](https://fancyalt.com/api-docs)

---

## 📸 What FancyAlt Can Do

- Analyze uploaded JPEG, PNG, and WEBP images
- Analyze publicly accessible HTTP and HTTPS image URLs
- Generate concise, accessibility-focused alt text
- Generate detailed visual descriptions
- Create natural descriptions for social media
- Create short fictional stories inspired by an image
- Extract meaningful readable text when requested
- Moderate every image before returning generated content
- Return consistent, structured JSON results
- Provide a responsive, keyboard-accessible interface
- Support light and dark themes
- Provide interactive Swagger API documentation

---

## 💡 Mode-Specific Request Design

FancyAlt requests only the result type selected by the user.

| Selected Mode | Generated Result | 
|---|---|
| `concise` | Concise alt text | 
| `detailed` | Detailed visual description | 
| `social` | Social media description | 
| `story` | Short fictional story | 
| `moderateOnly` | Moderation result only | 

Every image is still checked by the moderation service first.

When visible-text extraction is enabled, the text-detection fields are included in the same mode-specific image request. FancyAlt does not make a second image request for visible text.

The OpenAI client uses `maxRetries: 0`, so a failed mode-specific image request is not silently repeated by the SDK.

---

## 🛠 Tech Stack

- **Backend:** Node.js 20+ and Express.js 5
- **AI Image Processing:** OpenAI Responses API
- **Image and Story Model:** `gpt-5.4-mini`
- **Content Moderation:** `omni-moderation-latest`
- **Structured Output:** Zod
- **Image Uploads:** Multer memory storage
- **Request Validation:** express-validator
- **Frontend:** HTML5, custom CSS, and vanilla JavaScript
- **UI Assets:** Bootstrap, Font Awesome, and JSONEditor
- **Documentation:** OpenAPI 3.0, Swagger UI, and YAMLJS
- **Security:** Helmet, CORS, rate limiting, and custom input sanitization

---

## 🔍 How It Works

### Uploaded Images

1. The user uploads a JPEG, PNG, or WEBP image.
2. Multer validates the file type and 5 MB size limit.
3. The image is held temporarily in memory.
4. OpenAI Moderation checks the image.
5. If the mode is `moderateOnly`, FancyAlt returns the moderation result immediately.
6. Otherwise, FancyAlt makes one mode-specific image request and returns only the selected output.

### Public Image URLs

1. The user submits a public HTTP or HTTPS image URL.
2. FancyAlt validates the URL and rejects localhost or loopback addresses.
3. OpenAI Moderation checks the image.
4. If the mode is `moderateOnly`, FancyAlt returns the moderation result immediately.
5. Otherwise, FancyAlt makes one mode-specific image request and returns only the selected output.

---

## 📦 Result Structure

A successful non-moderation response includes:

- **Mode:** The selected result type
- **Moderation:** Safety results for the image
- **Output Text:** Only the requested description or story
- **Model:** The OpenAI model used for the generated output
- **Visible Text:** Optionally returned only when visible-text extraction is enabled

---

## 🧪 Analysis Modes

| Mode | Purpose |
|---|---|
| `concise` | Creates focused alt text for websites, documents, and applications |
| `detailed` | Creates a fuller visual description |
| `social` | Creates a natural description for social media |
| `story` | Creates a short fictional story directly from the image |
| `moderateOnly` | Runs only the image safety check |

---

## ⚙️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/jillmpla/fancyalt.git
cd fancyalt
```

### 2. Check Node.js

FancyAlt requires Node.js 20 or newer.

```bash
node --version
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create the Environment File

Copy `.env.example` to a new file named `.env`.

The environment file uses these values:

```env
OPENAI_API_KEY=your-openai-api-key

OPENAI_IMAGE_MODEL=gpt-5.4-mini
OPENAI_STORY_MODEL=gpt-5.4-mini
OPENAI_MODERATION_MODEL=omni-moderation-latest
```

Replace the placeholder API key in `.env` with your own OpenAI API key.

### 5. Start the Application

```bash
npm start
```

For development:

```bash
npm run dev
```

### 6. Open the Application

- **Frontend:** [http://localhost:5000](http://localhost:5000)
- **API Documentation:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **API Status:** [http://localhost:5000/api/status](http://localhost:5000/api/status)
- **Direct Status Check:** [http://localhost:5000/status](http://localhost:5000/status)

---

## 📦 API Overview

### Base URLs

```text
Production: https://fancyalt.com/api
Local:      http://localhost:5000/api
```

### Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/generate-caption` | Analyze an uploaded image |
| `POST` | `/api/analyze-url` | Analyze a public image URL |
| `GET` | `/api/status` | Check whether the API is running |

---

## 🖼️ Upload an Image

### Endpoint

```http
POST /api/generate-caption
```

### Content Type

```text
multipart/form-data
```

### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | File | Yes | JPEG, PNG, or WEBP image up to 5 MB |
| `mode` | String | No | Result mode; defaults to `concise` |
| `maxLength` | Integer | No | Preferred maximum length from 40 to 1,000 characters |
| `includeVisibleText` | Boolean | No | Whether readable text should be extracted; defaults to `true` when omitted |

### cURL Example

```bash
curl -X POST http://localhost:5000/api/generate-caption \
  -F "image=@example.jpg" \
  -F "mode=concise" \
  -F "maxLength=160" \
  -F "includeVisibleText=true"
```

---

## 🔗 Analyze a Public Image URL

### Endpoint

```http
POST /api/analyze-url
```

### Content Type

```text
application/json
```

### Example Request

```json
{
  "imageUrl": "https://example.com/images/kayak-dog.jpg",
  "mode": "detailed",
  "maxLength": 500,
  "includeVisibleText": true
}
```

### cURL Example

```bash
curl -X POST http://localhost:5000/api/analyze-url \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/images/kayak-dog.jpg",
    "mode": "detailed",
    "maxLength": 500,
    "includeVisibleText": true
  }'
```

The URL must be publicly accessible without authentication and must use HTTP or HTTPS.

---

## 📊 Example Responses

### Concise Alt Text

```json
{
  "mode": "concise",
  "flagged": false,
  "moderation": {
    "flagged": false,
    "flaggedCategories": [],
    "categories": {
      "sexual": false,
      "violence": false,
      "self-harm": false
    },
    "categoryScores": {
      "sexual": 0.00012,
      "violence": 0.00048,
      "self-harm": 0.00001
    },
    "appliedInputTypes": {
      "sexual": ["image"],
      "violence": ["image"]
    },
    "model": "omni-moderation-latest"
  },
  "output": {
    "text": "Golden retriever sitting beside a blue kayak at the edge of a calm lake.",
    "model": "gpt-5.4-mini",
    "containsText": false,
    "visibleText": []
  }
}
```

The `containsText` and `visibleText` properties are omitted when `includeVisibleText` is `false`.

### Story Mode

```json
{
  "mode": "story",
  "flagged": false,
  "moderation": {
    "flagged": false,
    "flaggedCategories": [],
    "categories": {},
    "categoryScores": {},
    "appliedInputTypes": {},
    "model": "omni-moderation-latest"
  },
  "output": {
    "text": "The retriever waited beside the kayak as the lake turned gold in the evening light. One quiet paddle remained before home.",
    "model": "gpt-5.4-mini"
  }
}
```

Story mode creates the story directly from the image. It doesn't first request a separate alt-text analysis.

### Moderation-Only Mode

```json
{
  "mode": "moderateOnly",
  "flagged": false,
  "moderation": {
    "flagged": false,
    "flaggedCategories": [],
    "categories": {},
    "categoryScores": {},
    "appliedInputTypes": {},
    "model": "omni-moderation-latest"
  }
}
```

Moderation-only responses don't include an `output` property.

---

## ❤️ Status Endpoint

```http
GET /api/status
```

The status endpoint returns service, version, environment, uptime, provider, and timestamp information.

---

## 🚨 Error Handling

FancyAlt uses centralized error handling, consistent status codes, and request IDs.

### Example Validation Error

```json
{
  "error": "Validation failed.",
  "requestId": "1c8ca594-8758-4c97-bb86-49cff66704f8",
  "details": [
    {
      "field": "mode",
      "location": "body",
      "message": "Mode must be one of the supported values.",
      "value": "invalidMode"
    }
  ]
}
```

### Common Status Codes

| Code | Meaning |
|---|---|
| `200` | Request completed successfully |
| `400` | Request data is missing or invalid |
| `403` | Request origin or resource is not allowed |
| `404` | Route does not exist |
| `413` | Uploaded image exceeds the 5 MB limit |
| `415` | Uploaded file type is not supported |
| `422` | Image could not be retrieved or processed |
| `429` | FancyAlt's API rate limit was exceeded |
| `500` | Unexpected server error |
| `502` | An upstream service returned an invalid response |
| `503` | OpenAI authentication, rate limiting, or service availability prevented processing |

Temporary `503` responses may include a `Retry-After` header.

Every request receives an `X-Request-ID` response header. Error responses also include the request ID in the JSON body.

---

## 🔐 Security and Privacy

- The OpenAI API key is stored only on the server.
- Uploaded images are held in memory and are not intentionally saved to disk.
- Only one image is accepted per request.
- Uploads are limited to 5 MB.
- Only JPEG, PNG, and WEBP uploads are accepted.
- Public image URLs are validated before processing.
- Localhost and loopback image URLs are rejected.
- Custom middleware removes dangerous request keys.
- Helmet applies standard HTTP security headers.
- CORS limits browser requests to approved origins.
- Each IP address is limited to 25 API requests every 15 minutes.
- Every request receives a unique request ID.

---

## ♿ Frontend Accessibility

The FancyAlt interface includes:

- Semantic HTML landmarks
- Clear form labels and descriptions
- A skip-navigation link
- Keyboard-accessible source tabs
- Keyboard-accessible upload controls
- Visible keyboard focus indicators
- Screen-reader status announcements
- Light and dark themes
- Reduced-motion support
- Human-readable result cards
- Copy-to-clipboard controls
- Responsive layouts

---

## 🗂️ Project Structure

```text
fancyalt/
├── .env.example
├── .gitignore
├── index.js
├── package.json
├── package-lock.json
├── README.md
├── swagger.yaml
├── LICENSE.txt
│
├── middlewares/
│   ├── asyncHandler.js
│   ├── sanitizeKeys.js
│   └── validate.js
│
├── routes/
│   ├── caption.js
│   └── status.js
│
├── services/
│   ├── imageAnalyzer.js
│   ├── imageInput.js
│   ├── imageModerator.js
│   ├── openaiClient.js
│   └── storyGenerator.js
│
├── utils/
│   └── errors.js
│
└── public/
    ├── index.html
    ├── index.css
    ├── footer.css
    ├── footer.js
    ├── swagger-custom.css
    │
    └── js/
        └── app.js
```

Static images, Bootstrap files, Font Awesome files, and third-party vendor assets are omitted for readability.

---

## 📚 API Documentation

FancyAlt includes interactive Swagger documentation generated from `swagger.yaml`.

- **Local:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **Production:** [https://fancyalt.com/api-docs](https://fancyalt.com/api-docs)
- **Raw OpenAPI File:** [http://localhost:5000/swagger.yaml](http://localhost:5000/swagger.yaml)

---

## 📄 License

See [`LICENSE.txt`](./LICENSE.txt) for the full license terms.

---

## 📬 Contact

For questions or support, email [fancyaltdotcom@gmail.com](mailto:fancyaltdotcom@gmail.com).

---

## ⭐ Support the Project

If you find FancyAlt useful, consider giving the repository a star.
