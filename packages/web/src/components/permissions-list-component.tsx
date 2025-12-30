type Permission = {
  effect: string;
  resource: string;
  actions: string[];
};

type PermissionsListComponentProps = {
  permissions: Permission[];
};

export const PermissionsListComponent = ({
  permissions,
}: PermissionsListComponentProps) => {
  return (
    <div className="space-y-1">
      {permissions.length > 0 ? (
        permissions.map((perm, idx) => (
          <div
            key={`${perm.resource}-${idx}`}
            className="flex items-start gap-2 text-xs py-1"
          >
            <span className="font-medium text-gray-600 w-12 flex-shrink-0">
              {perm.effect}
            </span>
            <code className="flex-1 text-gray-800">{perm.resource}</code>
            <span className="text-gray-600 w-28 flex-shrink-0 text-right">
              {perm.actions.join(", ")}
            </span>
          </div>
        ))
      ) : (
        <span className="text-sm text-gray-400 italic">No permissions</span>
      )}
    </div>
  );
};
