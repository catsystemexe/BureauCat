{ pkgs }: {
  deps = [
    pkgs.iproute_mptcp
    pkgs.azure-functions-core-tools
    pkgs.tesseract
    pkgs.poppler_utils
  ];
}
