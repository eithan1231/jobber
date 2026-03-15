#/bin/bash

# Install dependencies using NPM (issues with pnpm and mono repos, had to use npm)
npm install > /dev/null

# Archive essential files
zip -rvq archive.zip ./package.json ./src > /dev/null

# Get base url argument from argument, defaults to localhost:3000
TOKEN=${1}
BASE_URL=${2:-http://localhost:3000}

# Upload to Jobber
curl \
  --silent \
  --request POST \
  --url "$BASE_URL/api/job/publish/" \
  --header 'content-type: multipart/form-data' \
  --header "Authorization: Bearer $TOKEN" \
  --form 'archive=@archive.zip;type=application/zip' > /dev/null

rm archive.zip