{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
    pkgs.python3
    pkgs.gnumake
    pkgs.gcc
  ];
}
