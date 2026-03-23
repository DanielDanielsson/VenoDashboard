export const MobileBanner = () => {
  return (
    <div className="flex items-center justify-center bg-(--surface-muted) px-4 py-2 text-center md:hidden">
      <p className="ui_micro_label text-(--text-soft)">
        This app is designed for desktop. Some features may not work on smaller screens.
      </p>
    </div>
  );
};
