# SOYBREACH — Complete Technical Specification

## 1. Product

SOYBREACH is a booru-style archive focused on **visual text files**. Every post must contain a text-based visual file. An image attachment is optional. Posts are organized primarily through tags.

The visual identity should be dark, compact, readable, and database/archive-oriented rather than image-gallery-heavy.

## 2. Core rules

- A post MUST contain one visual text file.
- An optional image attachment MAY accompany the text file.
- Every post MUST have at least one tag.
- Text files MUST be downloadable.
- Registered users can upload, comment, and maintain profiles.
- Visitors can browse and search public posts.
- Search is tag-first.
- No image is required anywhere in the base UI.

## 3. Recommended production stack

Frontend:
- HTML/CSS/JavaScript or React/Next.js.
- Responsive mobile/desktop layout.

Backend:
- Node.js + Express/NestJS, or another REST-capable backend.
- PostgreSQL for users/posts/tags/comments.
- Object storage for uploaded text files and optional images.
- Server-side authentication using secure sessions or short-lived access tokens plus refresh tokens.

For a simple first production version, Supabase can provide PostgreSQL, authentication, and storage while the front end remains hosted separately.

## 4. Data model

### users
- id UUID primary key
- username unique
- email unique
- password_hash
- avatar_url nullable
- bio nullable
- role: user/mod/admin
- created_at
- updated_at

### posts
- id UUID primary key
- title
- text_file_url
- text_file_name
- text_file_mime
- text_file_size
- optional_image_url nullable
- uploader_id foreign key
- created_at
- updated_at
- visibility: public/unlisted/removed

### tags
- id UUID primary key
- name unique normalized
- display_name
- post_count
- created_at

### post_tags
- post_id foreign key
- tag_id foreign key
- composite primary key

### comments
- id UUID primary key
- post_id foreign key
- user_id foreign key
- body
- created_at
- updated_at
- deleted_at nullable

### reports
- id UUID
- reporter_id
- post_id nullable
- comment_id nullable
- reason
- status
- moderator_note
- created_at

## 5. Pages

### `/`
Home/recent posts:
- SOYBREACH logo
- navigation
- search field
- recent posts
- optional popular tags panel
- post cards showing text preview, title, uploader and tags
- pagination/infinite scrolling

### `/search`
Search:
- large search box
- tag autocomplete
- AND/OR search mode
- sort: newest, oldest, most commented, popular
- result count
- result grid/list
- pagination

### `/post/:id`
Post detail:
- title
- visual text viewer
- optional image
- complete tag list
- uploader profile link
- upload date
- download button
- comments
- report button
- edit/delete controls for owner
- moderation controls for moderators

### `/upload`
Upload:
- title
- required visual text file
- optional image
- required tags
- tag autocomplete
- content preview
- file size/type validation
- publish button
- clear upload errors

### `/login`
- username/email
- password
- login
- forgot password
- registration link

### `/register`
- username
- email
- password
- password confirmation
- terms/anti-abuse acknowledgement
- registration

### `/profile/:username`
- avatar
- username
- bio
- join date
- upload count
- comments count
- user's posts
- optional favorites/bookmarks

### `/settings`
- username/email settings
- password change
- avatar
- bio
- account deletion
- privacy controls

### `/tags`
- popular tags
- recently used tags
- alphabetical tag browser
- tag counts

### `/tag/:name`
- tag title
- post count
- matching posts
- related tags

## 6. API

Authentication:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Posts:
- `GET /api/posts`
- `POST /api/posts`
- `GET /api/posts/:id`
- `PATCH /api/posts/:id`
- `DELETE /api/posts/:id`
- `GET /api/posts/:id/download`

Search/tags:
- `GET /api/search?q=`
- `GET /api/tags`
- `GET /api/tags/:name`

Comments:
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments`
- `PATCH /api/comments/:id`
- `DELETE /api/comments/:id`

Users:
- `GET /api/users/:username`
- `GET /api/users/:username/posts`
- `PATCH /api/me`

Moderation:
- `POST /api/reports`
- `GET /api/mod/reports`
- `PATCH /api/mod/reports/:id`

## 7. Search behavior

Tags should be normalized to lowercase for matching.

Examples:
- `internet` → posts containing the `internet` tag.
- `internet archive` → posts containing both tags.
- `-politics` → exclude a tag.
- `"internet archive"` may optionally represent an exact tag phrase if phrases are supported.

Search results should never depend on image presence.

## 8. File handling

Allowed text formats should initially be limited to safe formats such as:
- `.txt`
- `.md`
- optionally `.html` after sanitization

Do NOT render arbitrary uploaded HTML directly in the main application origin.

Recommended limits:
- text file: 10 MB
- optional image: 10 MB
- configurable server-side

Generate safe filenames and never trust the original filename.

Set correct `Content-Type` and `Content-Disposition: attachment` for downloads.

## 9. Security

- Hash passwords with Argon2id or bcrypt.
- HTTPS only.
- CSRF protection if using cookie authentication.
- Rate-limit login, registration, comments, uploads and reports.
- Validate all uploaded file types and sizes server-side.
- Sanitize comment HTML; preferably store/render plain text.
- Escape text previews.
- Use prepared SQL statements/ORM.
- Do not expose storage credentials in frontend JavaScript.
- Add abuse reporting and moderator controls.
- Log security-sensitive events.
- Implement account/email verification if needed.

## 10. Moderation

Roles:
- user
- moderator
- admin

Moderators can:
- remove posts/comments
- lock comments
- review reports
- suspend accounts
- edit/remove tags

Admins can additionally:
- manage moderators
- configure upload limits
- manage site settings

## 11. UX/design system

Colors:
- Background: #11151b
- Surface: #181e26
- Border: #29313b
- Primary text: #e9edf2
- Secondary text: #8f9aaa
- Accent can be changed later to match SOYBREACH branding.

Typography:
- system UI for interface
- monospace for visual text previews

Design principles:
- compact archive interface
- high readability
- tags always visible
- minimal decorative clutter
- responsive
- keyboard-friendly
- no mandatory images

## 12. GitHub hosting

GitHub Pages can host the static frontend, but it CANNOT by itself safely implement:
- server-side accounts
- password authentication
- comments database
- persistent post uploads
- private credentials
- moderation backend

Therefore the recommended architecture is:

GitHub Pages → frontend

Backend/API → authentication, posts, comments, search

Database → PostgreSQL

Object storage → visual text files + optional images

Custom domain → `soybreach.com`

## 13. Deployment phases

Phase 1:
- static UI
- browse/search mock data
- responsive design
- GitHub Pages

Phase 2:
- backend
- database
- registration/login
- real posts
- downloads

Phase 3:
- comments
- profiles
- tag autocomplete
- moderation/reporting

Phase 4:
- production hardening
- backups
- rate limits
- monitoring
- custom domain
- search optimization

## 14. Acceptance criteria

The production site is complete when:
- users can register and log in
- authenticated users can create posts
- every post requires a visual text file
- images remain optional
- every post requires tags
- tags can be searched
- posts can be downloaded
- users can comment
- users have profiles
- owners can manage their own posts
- moderators can manage reports
- mobile and desktop layouts work
- unsafe uploads are rejected
- credentials and private backend secrets never appear in client code
