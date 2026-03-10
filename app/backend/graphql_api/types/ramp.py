"""RampTransactionType and RampBillType."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class RampTransactionType:
    id: str
    amount: float = 0.0
    currency: str = "USD"
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    transaction_date: Optional[str] = None
    cardholder_name: Optional[str] = None
    memo: Optional[str] = None
    status: Optional[str] = None

    @strawberry.field
    async def person(self, info: Info) -> Optional[Annotated["PersonType", strawberry.lazy(".person")]]:
        person_id = getattr(self, "_person_id", None)
        if not person_id:
            return None
        from graphql_api.types.person import _to_person

        data = await info.context.loaders.person_by_id.load(person_id)
        return _to_person(data) if data else None


@strawberry.type
class RampBillType:
    id: str
    vendor_name: Optional[str] = None
    amount: float = 0.0
    currency: str = "USD"
    due_at: Optional[str] = None
    issued_at: Optional[str] = None
    status: Optional[str] = None
    approval_status: Optional[str] = None
    invoice_number: Optional[str] = None
    memo: Optional[str] = None
    project_id: Optional[int] = None


def _to_txn(row: dict) -> RampTransactionType:
    obj = RampTransactionType(
        id=row["id"],
        amount=row.get("amount", 0.0),
        currency=row.get("currency", "USD"),
        merchant_name=row.get("merchant_name"),
        category=row.get("category"),
        transaction_date=row.get("transaction_date"),
        cardholder_name=row.get("cardholder_name"),
        memo=row.get("memo"),
        status=row.get("status"),
    )
    obj._person_id = row.get("person_id")  # type: ignore[attr-defined]
    return obj


def _to_bill(row: dict) -> RampBillType:
    return RampBillType(
        id=row["id"],
        vendor_name=row.get("vendor_name"),
        amount=row.get("amount", 0.0),
        currency=row.get("currency", "USD"),
        due_at=row.get("due_at"),
        issued_at=row.get("issued_at"),
        status=row.get("status"),
        approval_status=row.get("approval_status"),
        invoice_number=row.get("invoice_number"),
        memo=row.get("memo"),
        project_id=row.get("project_id"),
    )
