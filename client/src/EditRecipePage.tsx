import { useParams } from "react-router-dom";

export function EditRecipePage() {
    let { id } = useParams();

    return <div>{JSON.stringify({ id })}</div>;
}
