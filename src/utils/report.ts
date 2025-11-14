export const generateReportOverview = (event: any): string => {
  if (!event) return "Event details are missing.";

  const title = event.title || "The event";
  const objective = event.objective || "achieve its goals";
  const outcomes = event.proposed_outcomes || "positive results";

  // Construct a positive summary based on the provided data
  const summary = [
    `The program, "${title}", was successfully conducted with the primary aim to ${objective.toLowerCase()}.`,
    `The activity was well-received, resulting in ${outcomes.toLowerCase()}.`,
    `Overall, the event achieved its intended purpose, contributing positively to the participants' learning and skill development.`,
  ];

  return summary.join(' ');
};