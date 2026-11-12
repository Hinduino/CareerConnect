const APPLICATION_STATUSES = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  REJECTED: "Rejected",
  OFFER_DECLINED: "Offer Declined",
  CANCELLED: "Cancelled",
};

const APPLICATION_STATUS_VALUES = Object.values(APPLICATION_STATUSES);

module.exports = {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_VALUES,
};
