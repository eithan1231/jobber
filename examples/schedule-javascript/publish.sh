#/bin/bash

# Install only production dependencies
# pnpm install --prod --frozen-lockfile

# Install dependencies using NPM (issues with pnpm and mono repos, had to use npm)
npm install

# Archive essential files
zip -rv archive.zip ./package.json ./src ./node_modules

# Upload to Jobber
curl \
  --silent \
  --show-error \
  --request POST \
  --url 'http://localhost:3000/api/job/publish/' \
  --header 'content-type: multipart/form-data' \
  --form 'archive=@archive.zip;type=application/zip'

rm archive.zip