import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { updateJob } from "../../../../api/jobs";
import { JobberVersion } from "../../../../api/versions";
import { ConfirmButtonComponent } from "../../../../components/confirm-button-component";
import { JobPageComponent } from "../../../../components/job-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useJob } from "../../../../hooks/use-job";
import { useVersions } from "../../../../hooks/use-versions";
import { PermissionGuardComponent } from "../../../../components/permission-guard";

export const Component = () => {
  const { jobId } = useParams();

  if (!jobId) {
    return "Job ID is required";
  }

  const { job, jobError, reloadJob } = useJob(jobId);
  const { versions, versionsError, reloadVersions } = useVersions(jobId);

  const latestVersion = useMemo<JobberVersion | null>(() => {
    if (!versions || versions.length === 0) {
      return null;
    }

    return versions.sort((a, b) => b.created - a.created)[0];
  }, [versions]);

  useEffect(() => {
    const reloader = () => {
      reloadJob();
      reloadVersions();
    };

    reloader();

    const interval = setInterval(() => {
      reloader();
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  if ((!job && !jobError) || (!versions && !versionsError)) {
    return "loading...";
  }

  if (!job || jobError) {
    return "Failed to load";
  }

  const handleSetActiveVersion = async (versionId: string | null) => {
    const result = await updateJob(job.id, {
      jobVersionId: versionId,
    });

    if (!result.success) {
      console.error("Failed to update job version", result.message);
      return;
    }

    await Promise.all([
      reloadJob(), //
      reloadVersions(),
    ]);
  };

  return (
    <JobPageComponent job={job}>
      <div className="container mx-auto px-4 py-6 max-w-[900px]">
        {versions && versions.length > 0 && (
          <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
            <h2 className="text-xl font-semibold mb-2">Versions</h2>

            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Version</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version, index) => (
                  <tr
                    key={`${version.jobId}-${version.id}`}
                    className="border-b"
                  >
                    <td className="px-4 py-2 text-gray-700">
                      {version.version}
                      {latestVersion && version.id === latestVersion.id && (
                        <span className="mx-2 bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                          Latest
                        </span>
                      )}
                      {version.id === job.jobVersionId && (
                        <span className="mx-2 bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      <TimeSinceComponent timestamp={version.created} />
                    </td>

                    <td className="px-4 py-2 text-gray-700">
                      <PermissionGuardComponent
                        resource={`job/${job.id}/versions/${version.id}`}
                        action="write"
                      >
                        {index === 0 && version.id !== job.jobVersionId && (
                          <ConfirmButtonComponent
                            buttonClassName="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                            confirmTitle="Confirm Activation"
                            confirmDescription="Are you sure you want to activate this version? This will make it the active version for the job."
                            buttonText="Activate"
                            onConfirm={() => {
                              handleSetActiveVersion(version.id);
                            }}
                          />
                        )}

                        {version.id === job.jobVersionId && (
                          <ConfirmButtonComponent
                            buttonClassName="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                            confirmTitle="Confirm Deactivation"
                            confirmDescription="Are you sure you want to deactivate this version? This will stop all running instances of this version."
                            buttonText="Deactivate"
                            onConfirm={() => {
                              handleSetActiveVersion(null);
                            }}
                          />
                        )}

                        {index !== 0 && version.id !== job.jobVersionId && (
                          <ConfirmButtonComponent
                            buttonClassName="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md text-xs shadow-sm"
                            confirmTitle="Confirm Activation"
                            confirmDescription="Are you sure you want to activate this version? It will downgrade the current version."
                            buttonText="Activate"
                            onConfirm={() => {
                              handleSetActiveVersion(version.id);
                            }}
                          />
                        )}
                      </PermissionGuardComponent>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </JobPageComponent>
  );
};

export default Component;
