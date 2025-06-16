import { useState } from "react";

/**
 * This is a button, thats has a confirm popup when clicked. A callback when it receives a confirmation.
 */
export const PopupWithConfirm = (props: {
  buttonClassName?: string;
  buttonText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmTitle: string;
  confirmDescription?: string;

  confirmButtonText?: string;
}) => {
  const [visible, setVisible] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const handleConfirm = () => {
    setDisabled(true);

    if (props.onConfirm) {
      props.onConfirm();
    }

    setVisible(false);
    setDisabled(false);
  };

  const handleCancel = () => {
    setDisabled(true);

    if (props.onCancel) {
      props.onCancel();
    }

    setVisible(false);
    setDisabled(false);
  };

  return (
    <>
      <button
        className={props.buttonClassName}
        onClick={() => setVisible(true)}
      >
        {props.buttonText}
      </button>

      {visible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-xl text-red-600 text-center mb-4">
              {props.confirmTitle}
            </h2>
            <div className="mb-4">
              {props.confirmDescription && (
                <p className="text-gray-600">{props.confirmDescription}</p>
              )}
            </div>
            <div className="flex justify-between mt-6">
              <button
                onClick={handleCancel}
                className={
                  "font-semibold py-2 px-4 rounded " +
                  (disabled
                    ? "bg-gray-200 text-gray-800"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800")
                }
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={
                  "font-semibold py-2 px-4 rounded " +
                  (disabled
                    ? "bg-gray-200 text-gray-800"
                    : "text-white bg-red-600 hover:bg-red-700")
                }
              >
                {props.confirmButtonText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
