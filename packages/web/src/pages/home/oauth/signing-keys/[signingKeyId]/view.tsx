import { Link, useParams } from "react-router-dom";
import { HomePageComponent } from "../../../../../components/home-page-component";
import { TimeSinceComponent } from "../../../../../components/time-since-component";
import { useSigningKey } from "../../../../../hooks/use-signing-key";
import { PermissionGuardComponent } from "../../../../../components/permission-guard";

const Component = () => {
  const signingKeyId = useParams().signingKeyId || "";

  const { signingKey, signingKeyError } = useSigningKey(signingKeyId);

  if (!signingKey && !signingKeyError) {
    return (
      <HomePageComponent title="Loading...">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <svg
              className="h-12 w-12 text-gray-400 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>
      </HomePageComponent>
    );
  }

  if (signingKeyError || !signingKey) {
    return (
      <HomePageComponent title="Error">
        <div className="container mx-auto px-4 py-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="font-medium text-red-900">
              Error loading signing key
            </p>
            <p className="text-sm text-red-700 mt-1">{signingKeyError}</p>
          </div>
        </div>
      </HomePageComponent>
    );
  }

  return (
    <PermissionGuardComponent
      resource={`oauth/signing-key/${signingKeyId}`}
      action="read"
    >
      <HomePageComponent title={`Signing Key ${signingKey.id.slice(0, 8)}...`}>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/home/oauth/signing-keys/"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Signing Keys
            </Link>
          </div>

          {/* Single Key Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Key Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    OAuth Signing Key
                  </h1>
                  <div className="text-sm text-gray-600 mt-1 font-mono">
                    {signingKey.id}
                  </div>
                </div>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded ${
                    signingKey.status === "active"
                      ? "bg-green-100 text-green-800"
                      : signingKey.status === "inactive"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {signingKey.status}
                </span>
              </div>
            </div>

            {/* Key Details */}
            <div className="px-6 py-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Details
              </h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Algorithm</dt>
                  <dd className="text-sm text-gray-900">
                    <span className="inline-flex px-2 py-1 text-xs font-mono font-medium bg-gray-100 text-gray-700 rounded">
                      {signingKey.alg}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Use</dt>
                  <dd className="text-sm text-gray-900">
                    {signingKey.use === "sig" ? "Signature" : "Encryption"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Created</dt>
                  <dd className="text-sm text-gray-900">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(signingKey.createdAt).getTime() / 1000,
                      )}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Expires</dt>
                  <dd className="text-sm text-gray-900">
                    {signingKey.expiresAt ? (
                      <TimeSinceComponent
                        timestamp={Math.floor(
                          new Date(signingKey.expiresAt).getTime() / 1000,
                        )}
                      />
                    ) : (
                      <span className="text-gray-400 italic">Never</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Renews</dt>
                  <dd className="text-sm text-gray-900">
                    {signingKey.renewsAt ? (
                      <TimeSinceComponent
                        timestamp={Math.floor(
                          new Date(signingKey.renewsAt).getTime() / 1000,
                        )}
                      />
                    ) : (
                      <span className="text-gray-400 italic">N/A</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Created By</dt>
                  <dd className="text-sm text-gray-900 font-mono">
                    {signingKey.createdByUserId
                      ? `${signingKey.createdByUserId.slice(0, 8)}...`
                      : "System"}
                  </dd>
                </div>
                {signingKey.parentId && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Parent Key</dt>
                    <dd className="text-sm text-gray-900">
                      <Link
                        to={`/home/oauth/signing-keys/${signingKey.parentId}/`}
                        className="text-blue-600 hover:text-blue-800 font-mono"
                      >
                        {signingKey.parentId.slice(0, 8)}...
                      </Link>
                    </dd>
                  </div>
                )}
                {signingKey.childId && (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">Child Key</dt>
                    <dd className="text-sm text-gray-900">
                      <Link
                        to={`/home/oauth/signing-keys/${signingKey.childId}/`}
                        className="text-blue-600 hover:text-blue-800 font-mono"
                      >
                        {signingKey.childId.slice(0, 8)}...
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Public Key */}
            <div className="px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Public Key
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                  {signingKey.publicKey}
                </pre>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This public key can be used to verify JWT tokens signed by this
                key. It is also available via the{" "}
                <a
                  href="/.well-known/jwks.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  JWKS endpoint
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
