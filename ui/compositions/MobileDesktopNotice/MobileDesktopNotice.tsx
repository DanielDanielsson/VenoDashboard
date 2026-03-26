import { Icon } from '@ui/base/Icon';

export const MobileDesktopNotice = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center md:hidden">
      <Icon icon="veno-logo" twStyles="h-20 w-auto text-text" />
      <div className="max-w-sm">
        <p className="body_text text-text-soft">
          Veno Dashboard is designed for desktop. Open the site on a desktop device.
        </p>
      </div>
    </div>
  );
};
