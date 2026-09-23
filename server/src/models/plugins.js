// Expose `id` instead of `_id` and drop `__v` in API responses.
export function toJSONPlugin(schema) {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret._id;
      return ret;
    },
  });
}
