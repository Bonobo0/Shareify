"use client";

import React from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHouse, faUser } from "@fortawesome/free-solid-svg-icons";

export default function Breadcrumbs({ directoryId, breadcrumbs }) {
  if (!directoryId && breadcrumbs.length === 0) return null;

  return (
    <div className="breadcrumbs mb-4 text-sm">
      <ul>
        <li>
          <Link
            href="/dashboard"
            className="text-blue-700 hover:text-blue-800"
          >
            <FontAwesomeIcon icon={faHouse} /> 내 파일
          </Link>
        </li>
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.id}>
            <div className="flex items-center gap-1">
              {index === breadcrumbs.length - 1 ? (
                <>
                  <span className="font-medium">{crumb.name}</span>
                  {!crumb.isOwner && (
                    <span className="badge badge-accent badge-xs">
                      <FontAwesomeIcon icon={faUser} /> 공유받음
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Link
                    href={`/directory/${crumb.hash}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {crumb.name}
                  </Link>
                  {!crumb.isOwner && (
                    <span className="badge badge-accent badge-xs ml-1">
                      <FontAwesomeIcon icon={faUser} />
                    </span>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
