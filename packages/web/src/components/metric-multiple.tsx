import { Line } from "react-chartjs-2";
import { formatRelativeTime } from "../util.js";
import { useEffect } from "react";
import { useMetricMultiple } from "../hooks/use-metric-multiple.js";
import { JobberMetricType } from "../api/jobber.js";

export const MetricMultiple = (props: {
  jobId: string;
  metricType: JobberMetricType;
  axisYSuffix?: string;
  version?: string;
  duration?: string;
  autoUpdate?: boolean;
  showLegend?: boolean;
}) => {
  const { dataMetric, dataMetricError, reloadMetric } = useMetricMultiple(
    props.jobId,
    props.metricType,
    props?.version,
    props?.duration
  );

  useEffect(() => {
    if (props.autoUpdate) {
      const interval = setInterval(() => {
        reloadMetric();
      }, 5000);

      return () => clearInterval(interval);
    }
  });

  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      {dataMetricError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline">{dataMetricError}</span>
        </div>
      )}
      {dataMetric && (
        <Line
          height={60}
          width={200}
          data={{
            labels: dataMetric[0]?.values.map((item) =>
              formatRelativeTime(item.timestamp)
            ),
            datasets: dataMetric.map((item) => {
              return {
                label: item.label,
                data: item?.values.map((value) => value.value) ?? [],
                borderColor: "rgba(75, 192, 192, 1)",
                backgroundColor: "rgba(75, 192, 192, 0.2)",
                fill: true,
              };
            }),
          }}
          options={{
            responsive: true,

            scales: {
              y: {
                suggestedMin: 0,
                ticks: {
                  callback: (value) => {
                    if (typeof props.axisYSuffix === "undefined") {
                      return value;
                    }

                    if (typeof value === "number") {
                      return `${value.toFixed(2)} ${props.axisYSuffix}`;
                    }

                    return `${value} ${props.axisYSuffix}`;
                  },
                },
              },
            },
            plugins: {
              // subtitle: {
              //   display: true,
              //   text: `Version ${
              //     props.version
              //   }  -  avg ${dataMetricAverage?.toFixed(
              //     2
              //   )}ms  -  max ${dataMetricMax?.toFixed(
              //     2
              //   )}ms  -  min ${dataMetricMin?.toFixed(2)}ms`,
              //   padding: {
              //     bottom: 10,
              //   },
              // },
              legend: {
                display: !!props.showLegend,
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const value = context.parsed.y;

                    if (typeof props.axisYSuffix === "undefined") {
                      return `${value}`;
                    }

                    return `${value.toFixed(2)} ${props.axisYSuffix}`;
                  },
                },
              },
            },
          }}
        />
      )}
    </div>
  );
};
