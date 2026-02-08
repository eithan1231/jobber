#/bin/bash

# Install all dependencies
# pnpm install --frozen-lockfile

# Build application
# pnpm build

# Install only production dependencies
# pnpm install --prod --frozen-lockfile

# Install dependencies using NPM (issues with pnpm and mono repos, had to use npm)
npm install

# Build Package
npm run build

# Archive essential files
zip -rv archive.zip ./package.json ./dist ./src ./node_modules

# Upload to Jobber
curl \
  --silent \
  --show-error \
  --request POST \
  --url 'http://localhost:3000/api/job/publish/' \
  --header 'content-type: multipart/form-data' \
  --header 'Authorization: Bearer eab549247662024701c92a1cdd4af07c45d8ebcd5acf73be0f7a242926a03e266ff174' \
  --form 'archive=@archive.zip;type=application/zip'

rm archive.zip