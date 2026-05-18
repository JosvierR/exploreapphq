type BrandLogoProps = {
  showName?: boolean;
  size?: number;
};

export function BrandLogo({ showName = true, size = 36 }: BrandLogoProps) {
  return (
    <>
      <img
        src="/icon-192.png"
        alt=""
        className="brand-logo-img"
        width={size}
        height={size}
        aria-hidden={showName}
      />
      {showName && <span>Explore</span>}
    </>
  );
}
