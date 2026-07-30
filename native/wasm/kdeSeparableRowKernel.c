int accumulate_row(
  const double *x_kernel,
  const double *y_weights,
  double *output,
  int observations,
  int grid_size
) {
  if (!x_kernel || !y_weights || !output || observations < 1 || grid_size < 1) return -1;

  for (int column = 0; column < grid_size; column++) {
    double sum = 0.0;
    for (int observation = 0; observation < observations; observation++) {
      sum += x_kernel[observation * grid_size + column] * y_weights[observation];
    }
    output[column] = sum;
  }

  return 0;
}
