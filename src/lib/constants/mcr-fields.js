// MCR (Mortgage Call Report) / HMDA field constants
// Used for quarterly reporting to NMLS via Tracker (Mac)

export const ACTION_TAKEN = {
  ORIGINATED: 'originated',
  DENIED: 'denied',
  WITHDRAWN: 'withdrawn',
  INCOMPLETE: 'incomplete',
  PURCHASED: 'purchased',
};

export const ACTION_TAKEN_LABELS = {
  originated: 'Originated',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
  incomplete: 'Incomplete',
  purchased: 'Purchased',
};

export const APPLICATION_METHODS = {
  FACE_TO_FACE: 'face_to_face',
  PHONE: 'phone',
  INTERNET: 'internet',
};

export const APPLICATION_METHOD_LABELS = {
  face_to_face: 'Face-to-Face',
  phone: 'Phone',
  internet: 'Internet',
};

export const LIEN_STATUSES = {
  FIRST: 'first',
  SUBORDINATE: 'subordinate',
  UNSECURED: 'unsecured',
};

export const LIEN_STATUS_LABELS = {
  first: 'First Lien',
  subordinate: 'Subordinate Lien',
  unsecured: 'Unsecured',
};

export const LEAD_SOURCES = [
  { value: 'homepage_rate_table', label: 'Homepage Rate Table' },
  { value: 'rate_tool', label: 'Rate Tool' },
  { value: 'contact_form', label: 'Contact Form' },
  { value: 'referral', label: 'Referral' },
  { value: 'direct', label: 'Direct' },
  { value: 'realtor', label: 'Realtor' },
  { value: 'builder', label: 'Builder' },
  { value: 'past_client', label: 'Past Client' },
  { value: 'other', label: 'Other' },
];

export const APPLICATION_CHANNELS = [
  { value: 'online', label: 'Online' },
  { value: 'branch', label: 'Branch' },
  { value: 'phone', label: 'Phone' },
];
