import { useState } from 'react';
import { req } from '../api';
import { btnCls, Field, FormError, ghostCls, inputCls, Modal, Stars, useDialog } from './ui';

type Props = { productId: number; productTitle: string; onClose: () => void };

export default function ReviewModal({ productId, productTitle, onClose }: Props) {
  const { notify } = useDialog();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!rating) return setError('Please choose a star rating.');
    try {
      await req(`/products/${productId}/reviews`, 'POST', { rating, comment });
      onClose();
      notify('Thank you! Your review has been saved.', 'success');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Modal title={`Review: ${productTitle}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Your rating" required>
          <Stars value={rating} onChange={setRating} size="text-3xl" />
        </Field>
        <Field label="Your review">
          <textarea
            className={inputCls}
            rows={4}
            placeholder="Tell others what you liked or did not like"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Field>
        <FormError text={error} />
        <div className="flex justify-end gap-2">
          <button className={ghostCls} onClick={onClose}>Cancel</button>
          <button className={btnCls} onClick={submit}>Submit review</button>
        </div>
      </div>
    </Modal>
  );
}
