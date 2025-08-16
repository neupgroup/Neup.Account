'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

const PageProgressBar = () => {
  return (
    <ProgressBar
      height="1px"
      color="#47b5a7"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
};

export default PageProgressBar;
