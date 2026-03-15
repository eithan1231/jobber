export const handlerHttp = async (context) => {
  const host = context.request.header("host");

  context.response.html(`
    <html>
      <head>
        <title>Jobber HTTP JavaScript Example</title>
      </head>
      <body>
        <h1>Jobber HTTP JavaScript Example</h1>
        <p>This is an example of a simple HTTP server built with Jobber and JavaScript.</p>
        <p>To test this out, send a request to this endpoint using curl or your browser:</p>
        <pre><code>curl http://${host}/</code></pre>
      </body>
    </html>
  `);
};
