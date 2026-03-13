function Logo({ small }: { small?: boolean }) {
  return (
    <img
      src="/logo.svg"
      alt="Skittles"
      className={`logo ${small ? "logo--small" : ""}`}
    />
  );
}

export default Logo;
